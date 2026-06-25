"""VayuNetra REST API. Thin layer over the services — every handler degrades cleanly."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.agents.briefing import city_briefing
from app.agents.enforcement import narrative_brief
from app.agents.llm import llm
from app.core.logging import get_logger
from app.data.repository import get_city_observations
from app.domain.cities import get_city, list_cities
from app.schemas.city import City
from app.schemas.forecast import ZoneForecast
from app.schemas.grid import GridResponse
from app.schemas.intelligence import CityComparison, CityIntelligence
from app.schemas.scenario import SimulationResult, ZoneHistory
from app.services import grid as grid_service
from app.services.attribution_validation import validate as validate_attribution
from app.services.enforcement_roi import optimize as roi_optimize
from app.services.health_cost import city_health_cost
from app.services.compliance import city_compliance, intervention_ledger
from app.services.blame_graph import blame_graph as build_blame_graph
from app.services.downscale import factor_at, scale_forecast
from app.services.intelligence_service import compare_cities, get_city_intelligence, get_model
from app.services.scenario import build_history, city_whatif, lockdown_check, simulate_reduction

log = get_logger("vayunetra.api.routes")
router = APIRouter(prefix="/api")


def _require_city(cid: str) -> City:
    city = get_city(cid)
    if city is None:
        raise HTTPException(status_code=404, detail=f"Unknown city '{cid}'")
    return city


@router.get("/cities", response_model=list[City], tags=["cities"])
def cities():
    return list_cities()


@router.get("/compare", response_model=list[CityComparison], tags=["cities"])
def compare():
    return compare_cities()


@router.get("/cities/{cid}", response_model=City, tags=["cities"])
def city_detail(cid: str):
    return _require_city(cid)


@router.get("/cities/{cid}/intelligence", response_model=CityIntelligence, tags=["intelligence"])
def intelligence(cid: str, mode: str = "auto", refresh: bool = False):
    _require_city(cid)
    try:
        return get_city_intelligence(cid, mode=mode, refresh=refresh)
    except Exception as exc:
        log.exception("intelligence build failed for %s", cid)
        raise HTTPException(status_code=503, detail=f"Intelligence unavailable: {exc}")


@router.get("/cities/{cid}/grid", response_model=GridResponse, tags=["intelligence"])
def grid(cid: str, layer: str = Query("current"), horizon: int = Query(24, ge=0, le=120)):
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    return grid_service.build_aqi_grid(city, intel, layer=layer, horizon=horizon)


@router.get("/cities/{cid}/zones/{zid}/forecast", response_model=ZoneForecast, tags=["forecast"])
def zone_forecast(cid: str, zid: str, hours: int = Query(72, ge=1, le=120)):
    city = _require_city(cid)
    if not any(z.id == zid for z in city.zones):
        raise HTTPException(status_code=404, detail=f"Unknown zone '{zid}' in {cid}")
    obs = get_city_observations(cid, mode="auto")
    model = get_model(cid)
    zf = model.predict_zone(obs, city, zid, future_hours=hours)
    z = next(zz for zz in city.zones if zz.id == zid)
    return scale_forecast(zf, factor_at(city, obs.landuse, z.center.lat, z.center.lon))


@router.get("/cities/{cid}/enforcement/{zid}/brief", tags=["intelligence"])
def enforcement_brief(cid: str, zid: str):
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    item = next((e for e in intel.enforcement if e.zone_id == zid), None)
    if item is None:
        raise HTTPException(status_code=404, detail=f"No enforcement item for zone '{zid}'")
    return {"zone_id": zid, "generated_by": "llm" if llm.enabled else "template",
            "brief": narrative_brief(item, city.name)}


@router.get("/cities/{cid}/zones/{zid}/history", response_model=ZoneHistory, tags=["forecast"])
def zone_history(cid: str, zid: str, hours: int = Query(48, ge=6, le=168)):
    city = _require_city(cid)
    if not any(z.id == zid for z in city.zones):
        raise HTTPException(status_code=404, detail=f"Unknown zone '{zid}' in {cid}")
    obs = get_city_observations(cid, mode="auto")
    return build_history(city, obs, zid, hours)


@router.get("/cities/{cid}/zones/{zid}/simulate", response_model=SimulationResult, tags=["intelligence"])
def simulate(cid: str, zid: str, source: str = Query(...), reduction: float = Query(0.3, ge=0, le=1)):
    _require_city(cid)
    intel = get_city_intelligence(cid)
    attr = next((a for a in intel.attributions if a.zone_id == zid), None)
    if attr is None:
        raise HTTPException(status_code=404, detail=f"No attribution for zone '{zid}'")
    return simulate_reduction(attr, source, reduction)


@router.get("/cities/{cid}/briefing", tags=["intelligence"])
def briefing(cid: str):
    _require_city(cid)
    return city_briefing(get_city_intelligence(cid))


@router.get("/cities/{cid}/attribution-validation", tags=["intelligence"])
def attribution_validation(cid: str):
    """Our source split vs published receptor-model studies — the honest accuracy check."""
    _require_city(cid)
    intel = get_city_intelligence(cid)
    result = validate_attribution(cid, intel.attributions)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No reference apportionment for '{cid}'")
    return result


@router.get("/cities/{cid}/enforcement/roi", tags=["intelligence"])
def enforcement_roi(cid: str, inspectors: int = Query(3, ge=1, le=50)):
    """Deploy N inspectors for maximum impact — which wards cover the most pollution burden."""
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    return roi_optimize(city, intel.attributions, inspectors)


@router.get("/cities/{cid}/health-cost", tags=["intelligence"])
def health_cost(cid: str):
    """Air-Health-Cost Index — the daily ₹ damage of this city's pollution, per ward."""
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    return city_health_cost(city, intel.attributions)


@router.get("/compliance", tags=["cities"])
def compliance():
    """Compliance scorecard for every city — live PM2.5 vs CPCB NAAQS + WHO guideline."""
    out = []
    for c in list_cities():
        try:
            intel = get_city_intelligence(c.id)
            out.append(city_compliance(get_city(c.id), intel.attributions))
        except Exception as exc:
            log.warning("compliance failed for %s: %s", c.id, exc)
    out.sort(key=lambda x: x["avg_pm25"], reverse=True)
    return out


@router.get("/interventions", tags=["intelligence"])
def interventions():
    """Honest ledger of real air-quality interventions and what they actually did to AQI."""
    return intervention_ledger()


@router.get("/cities/{cid}/lockdown-check", tags=["intelligence"])
def lockdown_check_endpoint(cid: str):
    """Validate the what-if engine vs the 2020 lockdown natural experiment (real measured drop)."""
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    return lockdown_check(city, intel.attributions)


@router.get("/cities/{cid}/blame-graph", tags=["intelligence"])
def blame_graph_endpoint(cid: str):
    """Wind-transport 'who pollutes whom' graph — directed source→receptor edges between wards."""
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    return build_blame_graph(city, intel.attributions)


@router.get("/cities/{cid}/whatif", tags=["intelligence"])
def whatif(cid: str, vehicular: float = 0.0, industrial: float = 0.0,
           dust_construction: float = 0.0, biomass_burning: float = 0.0, secondary: float = 0.0):
    """City-wide what-if: cut sources by these fractions → new city AQI + people protected."""
    city = _require_city(cid)
    intel = get_city_intelligence(cid)
    reductions = {"vehicular": vehicular, "industrial": industrial,
                  "dust_construction": dust_construction, "biomass_burning": biomass_burning,
                  "secondary": secondary}
    return city_whatif(city, intel.attributions, reductions)
