"""Citizen health-advisory agent. LLM produces native-script multilingual text when a key
is present; otherwise reliable English + Hindi templates keyed to the CPCB risk band.
"""
from __future__ import annotations

from app.agents.llm import llm
from app.core.logging import get_logger
from app.schemas.attribution import ZoneAttribution
from app.schemas.city import Zone
from app.schemas.forecast import ZoneForecast
from app.schemas.intelligence import AdvisoryItem

log = get_logger("vayunetra.advisory")

_RISK = {  # CPCB category -> risk band
    "Good": "Low", "Satisfactory": "Low", "Moderate": "Moderate",
    "Poor": "High", "Very Poor": "High", "Severe": "Severe",
}

_LANG_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil",
               "pa": "Punjabi", "ur": "Urdu", "te": "Telugu", "mr": "Marathi", "bn": "Bengali"}

# Per-risk-band advisories in native script. Authored offline (no live translation API),
# so every city gets its regional language deterministically even when the LLM is offline:
# Marathi (Mumbai), Bengali (Kolkata), Tamil (Chennai), Telugu (Hyderabad), Kannada (Bengaluru).
_TEMPLATES: dict[str, dict] = {
    "Low": {
        "headline": "Air quality is acceptable",
        "guidance": ["Normal outdoor activity is fine.",
                     "Unusually sensitive individuals should monitor for symptoms."],
        "en": "Air quality in {zone} is {cat} (AQI {aqi}). It is generally safe to be outdoors.",
        "hi": "{zone} में वायु गुणवत्ता {cat} है (AQI {aqi})। बाहर रहना आमतौर पर सुरक्षित है।",
        "mr": "{zone} मधील हवेची गुणवत्ता समाधानकारक आहे (AQI {aqi}). बाहेर राहणे साधारणपणे सुरक्षित आहे.",
        "bn": "{zone}-এ বাতাসের গুণমান সন্তোষজনক (AQI {aqi})। বাইরে থাকা সাধারণত নিরাপদ।",
        "ta": "{zone}-இல் காற்றின் தரம் ஏற்றுக்கொள்ளத்தக்கது (AQI {aqi}). வெளியில் இருப்பது பொதுவாக பாதுகாப்பானது.",
        "te": "{zone}లో గాలి నాణ్యత ఆమోదయోగ్యంగా ఉంది (AQI {aqi}). బయట ఉండటం సాధారణంగా సురక్షితం.",
        "kn": "{zone}ನಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಸ್ವೀಕಾರಾರ್ಹವಾಗಿದೆ (AQI {aqi}). ಹೊರಗಿರುವುದು ಸಾಮಾನ್ಯವಾಗಿ ಸುರಕ್ಷಿತ.",
    },
    "Moderate": {
        "headline": "Sensitive groups should take care",
        "guidance": ["Sensitive groups (asthma, heart/lung conditions) should limit prolonged outdoor exertion.",
                     "Children and the elderly should take indoor breaks."],
        "en": "Air quality in {zone} is Moderate (AQI {aqi}). Sensitive groups should reduce prolonged outdoor exertion.",
        "hi": "{zone} में वायु गुणवत्ता मध्यम है (AQI {aqi})। संवेदनशील समूह लंबे समय तक बाहरी परिश्रम कम करें।",
        "mr": "{zone} मधील हवेची गुणवत्ता मध्यम आहे (AQI {aqi}). संवेदनशील गटांनी दीर्घकाळ बाहेरील श्रम कमी करावेत.",
        "bn": "{zone}-এ বাতাসের গুণমান মাঝারি (AQI {aqi})। সংবেদনশীল গোষ্ঠীর দীর্ঘক্ষণ বাইরে পরিশ্রম কমানো উচিত।",
        "ta": "{zone}-இல் காற்றின் தரம் மிதமானது (AQI {aqi}). உணர்திறன் கொண்டவர்கள் நீண்ட நேரம் வெளியில் உழைப்பதைக் குறைக்க வேண்டும்.",
        "te": "{zone}లో గాలి నాణ్యత మధ్యస్థంగా ఉంది (AQI {aqi}). సున్నితమైన వ్యక్తులు ఎక్కువసేపు బయట శ్రమను తగ్గించాలి.",
        "kn": "{zone}ನಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಮಧ್ಯಮವಾಗಿದೆ (AQI {aqi}). ಸೂಕ್ಷ್ಮ ಗುಂಪುಗಳು ದೀರ್ಘಕಾಲ ಹೊರಾಂಗಣ ಶ್ರಮವನ್ನು ಕಡಿಮೆ ಮಾಡಬೇಕು.",
    },
    "High": {
        "headline": "Reduce outdoor exposure",
        "guidance": ["Everyone should reduce prolonged or heavy outdoor exertion.",
                     "Sensitive groups should stay indoors and wear an N95 mask outdoors.",
                     "Schools should move sports and assemblies indoors."],
        "en": "Air quality in {zone} is {cat} (AQI {aqi}) — unhealthy. Limit outdoor activity; sensitive "
              "people should stay indoors and wear an N95 mask outside. Schools should move activities indoors.",
        "hi": "{zone} में वायु गुणवत्ता {cat} है (AQI {aqi}) — हानिकारक। बाहरी गतिविधि सीमित करें; संवेदनशील लोग "
              "घर के अंदर रहें और बाहर N95 मास्क पहनें। स्कूल गतिविधियाँ अंदर करें।",
        "mr": "{zone} मधील हवेची गुणवत्ता खराब आहे (AQI {aqi}) — आरोग्यास हानिकारक. बाहेरील क्रिया मर्यादित करा; "
              "संवेदनशील व्यक्तींनी घरातच राहावे आणि बाहेर N95 मास्क वापरावा.",
        "bn": "{zone}-এ বাতাসের গুণমান খারাপ (AQI {aqi}) — স্বাস্থ্যের জন্য ক্ষতিকর। বাইরের কার্যকলাপ সীমিত করুন; "
              "সংবেদনশীল ব্যক্তিরা ঘরে থাকুন এবং বাইরে N95 মাস্ক পরুন।",
        "ta": "{zone}-இல் காற்றின் தரம் மோசமாக உள்ளது (AQI {aqi}) — உடல்நலத்திற்கு கேடு. வெளிப்புற செயல்பாட்டைக் "
              "கட்டுப்படுத்துங்கள்; உணர்திறன் உள்ளவர்கள் வீட்டிற்குள் இருங்கள், வெளியில் N95 முகக்கவசம் அணியுங்கள்.",
        "te": "{zone}లో గాలి నాణ్యత అనారోగ్యకరంగా ఉంది (AQI {aqi}). బయటి కార్యకలాపాలను పరిమితం చేయండి; సున్నితమైనవారు "
              "ఇంట్లోనే ఉండి బయట N95 మాస్క్ ధరించండి.",
        "kn": "{zone}ನಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಅನಾರೋಗ್ಯಕರವಾಗಿದೆ (AQI {aqi}). ಹೊರಾಂಗಣ ಚಟುವಟಿಕೆಯನ್ನು ಮಿತಿಗೊಳಿಸಿ; "
              "ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು ಮನೆಯೊಳಗಿರಿ ಮತ್ತು ಹೊರಗೆ N95 ಮಾಸ್ಕ್ ಧರಿಸಿ.",
    },
    "Severe": {
        "headline": "Health emergency — avoid outdoor exposure",
        "guidance": ["Avoid all outdoor exertion.", "Keep windows closed; run an air purifier if available.",
                     "Wear an N95 mask if you must step out.",
                     "Protect children, the elderly and outdoor workers; schools should consider suspension."],
        "en": "Air quality in {zone} is SEVERE (AQI {aqi}) — a health emergency. Avoid the outdoors, keep windows "
              "shut, run purifiers, and wear an N95 mask outside. Schools should consider suspension.",
        "hi": "{zone} में वायु गुणवत्ता गंभीर है (AQI {aqi}) — स्वास्थ्य आपातकाल। बाहर जाने से बचें, खिड़कियाँ बंद रखें, "
              "प्यूरीफायर चलाएँ और बाहर N95 मास्क पहनें। स्कूल स्थगन पर विचार करें।",
        "mr": "{zone} मधील हवेची गुणवत्ता अतिशय गंभीर आहे (AQI {aqi}) — आरोग्य आणीबाणी. बाहेर जाणे टाळा, खिडक्या बंद "
              "ठेवा, एअर प्युरिफायर चालवा आणि बाहेर N95 मास्क वापरा.",
        "bn": "{zone}-এ বাতাসের গুণমান অত্যন্ত খারাপ (AQI {aqi}) — স্বাস্থ্য জরুরি অবস্থা। বাইরে যাওয়া এড়িয়ে চলুন, "
              "জানালা বন্ধ রাখুন, এয়ার পিউরিফায়ার চালান এবং বাইরে N95 মাস্ক পরুন।",
        "ta": "{zone}-இல் காற்றின் தரம் மிகவும் மோசம் (AQI {aqi}) — சுகாதார அவசரநிலை. வெளியில் செல்வதைத் தவிர்க்கவும், "
              "ஜன்னல்களை மூடி வைக்கவும், காற்று சுத்திகரிப்பானை இயக்கவும், வெளியில் N95 முகக்கவசம் அணியவும்.",
        "te": "{zone}లో గాలి నాణ్యత తీవ్రంగా ఉంది (AQI {aqi}) — ఆరోగ్య అత్యవసర పరిస్థితి. బయటకు వెళ్లడం మానుకోండి, "
              "కిటికీలు మూసి ఉంచండి, ప్యూరిఫైయర్ నడపండి, బయట N95 మాస్క్ ధరించండి.",
        "kn": "{zone}ನಲ್ಲಿ ಗಾಳಿಯ ಗುಣಮಟ್ಟ ತೀವ್ರವಾಗಿದೆ (AQI {aqi}) — ಆರೋಗ್ಯ ತುರ್ತುಸ್ಥಿತಿ. ಹೊರಗೆ ಹೋಗುವುದನ್ನು ತಪ್ಪಿಸಿ, "
              "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ, ಪ್ಯೂರಿಫೈಯರ್ ಚಲಾಯಿಸಿ, ಹೊರಗೆ N95 ಮಾಸ್ಕ್ ಧರಿಸಿ.",
    },
}


def _peak_next_24h(forecast: ZoneForecast):
    pts = [p for p in forecast.points if p.horizon_h <= 24] or forecast.points
    return max(pts, key=lambda p: p.aqi) if pts else None


def _llm_translations(zone: Zone, cat: str, aqi: int, risk: str, dom_label: str,
                      languages: list[str]) -> dict[str, str] | None:
    names = [f"{c} ({_LANG_NAMES.get(c, c)})" for c in languages]
    system = ("You are a public-health communicator for Indian city authorities. Write short, "
              "calm, actionable air-quality advisories (max 2 sentences) in the requested languages, "
              "using correct native script. Keep medical guidance accurate for the AQI band.")
    prompt = (f"Zone: {zone.name}. AQI {aqi} ({cat}, {risk} risk). Dominant source: {dom_label}. "
              f"This ward has ~{zone.population or 0:,} residents and {zone.vulnerable_sites or 0} "
              f"schools/hospitals. Produce a JSON object mapping each language code to its advisory "
              f"text. Language codes: {', '.join(names)}.")
    out = llm.generate_json(system, prompt, max_tokens=900)
    if not out:
        return None
    cleaned = {k: str(v) for k, v in out.items() if k in languages and isinstance(v, str) and v.strip()}
    return cleaned or None


def build_advisory(zone: Zone, forecast: ZoneForecast, attribution: ZoneAttribution | None,
                   languages: list[str]) -> AdvisoryItem:
    peak = _peak_next_24h(forecast)
    aqi = peak.aqi if peak else (attribution.aqi if attribution else 0)
    cat = peak.category if peak else (attribution.category if attribution else "Unknown")
    color = peak.color if peak else "#888888"
    risk = _RISK.get(cat, "Moderate")
    tmpl = _TEMPLATES[risk]
    dom_label = attribution.dominant_label if attribution else "mixed sources"

    fields = {"zone": zone.name, "cat": cat, "aqi": aqi}
    languages_out: dict[str, str] = {}
    generated_by = "template"

    if llm.enabled:
        got = _llm_translations(zone, cat, aqi, risk, dom_label, languages)
        if got:
            languages_out = got
            generated_by = "llm"

    if not languages_out:
        # deterministic per-language templates — emit every configured language we have
        # native text for (so Mumbai always gets Marathi, Chennai Tamil, etc.), English always.
        wanted = set(languages) | {"en"}
        languages_out = {lang: tmpl[lang].format(**fields) for lang in wanted if lang in tmpl}
        if "en" not in languages_out:
            languages_out["en"] = tmpl["en"].format(**fields)

    pop = zone.population or 0
    vuln = zone.vulnerable_sites or 0
    vulnerable_note = (f"~{pop:,} residents · {vuln} schools/hospitals in this ward"
                       if pop or vuln else "Exposure data unavailable")

    return AdvisoryItem(
        zone_id=zone.id, zone_name=zone.name,
        horizon_h=peak.horizon_h if peak else 24, peak_aqi=aqi, category=cat, color=color,
        risk_level=risk, headline=tmpl["headline"], guidance=tmpl["guidance"],
        vulnerable_note=vulnerable_note, languages=languages_out, generated_by=generated_by,
    )
