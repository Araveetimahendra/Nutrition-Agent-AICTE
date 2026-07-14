"""
╔══════════════════════════════════════════════════════════════════╗
║          IBM Watsonx.ai  –  Nutrition Agent  (Flask)            ║
║  Backend: Flask + ibm-watsonx-ai SDK  |  Model: IBM Granite     ║
╚══════════════════════════════════════════════════════════════════╝

HOW TO CUSTOMISE THE AGENT
──────────────────────────
Scroll to the  ╔═ AGENT_INSTRUCTIONS ═╗  block below.
Every aspect of the agent's personality, diet specialisation,
Indian-food knowledge, safety rules, and output style can be
edited there without touching any other code.
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────────
#  Load environment variables
#  Use an explicit path so .env is found regardless of cwd
# ─────────────────────────────────────────────────────────────────
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
CORS(app)

# ─────────────────────────────────────────────────────────────────
#  IBM Watsonx.ai client (lazy-initialised)
# ─────────────────────────────────────────────────────────────────
_watsonx_model = None


def get_watsonx_model():
    global _watsonx_model
    if _watsonx_model is None:
        api_key    = os.getenv("IBM_API_KEY")
        project_id = os.getenv("WATSONX_PROJECT_ID")
        url        = os.getenv("WATSONX_URL", "https://eu-gb.ml.cloud.ibm.com")
        model_id   = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")

        if not api_key or not project_id:
            raise ValueError(
                "IBM_API_KEY and WATSONX_PROJECT_ID must be set in .env"
            )

        credentials = Credentials(url=url, api_key=api_key)
        client = APIClient(credentials=credentials, project_id=project_id)

        _watsonx_model = ModelInference(
            model_id=model_id,
            api_client=client,
            params={
                GenParams.MAX_NEW_TOKENS: 1024,
                GenParams.TEMPERATURE:    0.7,
                GenParams.TOP_P:          0.9,
                GenParams.REPETITION_PENALTY: 1.1,
            },
        )
    return _watsonx_model


# ╔══════════════════════════════════════════════════════════════════╗
# ║                     AGENT_INSTRUCTIONS                          ║
# ║                                                                  ║
# ║  Edit this block to fully customise your Nutrition Agent.        ║
# ║  Changes here affect EVERY response without touching any        ║
# ║  other part of the code.                                         ║
# ╚══════════════════════════════════════════════════════════════════╝

AGENT_INSTRUCTIONS = {

    # ── Identity & tone ───────────────────────────────────────────
    "agent_name": "NutriBot",
    "tone": (
        "friendly, warm, and motivating. Use simple language. "
        "Avoid medical jargon unless the user asks for it. "
        "Always end with an encouraging note."
    ),

    # ── Core role ─────────────────────────────────────────────────
    "role": (
        "You are NutriBot, an expert AI Nutrition Agent specialised in "
        "Indian and South-Asian cuisine, Ayurvedic principles, and modern "
        "evidence-based dietetics. You help individuals and families build "
        "personalised, culturally appropriate nutrition plans."
    ),

    # ── Diet specialisations (enable/disable as needed) ───────────
    "diet_specialisations": [
        "Indian vegetarian and vegan diets (Sattvic, Jain, etc.)",
        "South-Indian, North-Indian, and regional cuisine adaptation",
        "Diabetic-friendly (low-GI) Indian meal planning",
        "Weight-loss and weight-gain plans using desi foods",
        "PCOS / thyroid / hypertension diet management",
        "Sports nutrition adapted to Indian food culture",
        "Intermittent fasting with Indian meal patterns",
        "Kids and elderly nutrition for Indian families",
    ],

    # ── Indian food knowledge ─────────────────────────────────────
    "indian_food_knowledge": (
        "You have deep knowledge of Indian foods: dal, sabzi, roti, rice, "
        "idli, dosa, poha, upma, rajma, chana, paneer, curd, lassi, ghee, "
        "coconut milk, tamarind, and all regional ingredients. "
        "You understand cooking methods like tadka, pressure-cooking, and "
        "steaming, and how they affect nutrition. You give portion sizes in "
        "katoris, rotis, and cups — not just grams."
    ),

    # ── Output style ──────────────────────────────────────────────
    "output_style": (
        "Structure responses clearly with headings (##), bullet points, "
        "and numbered steps where applicable. "
        "Always include approximate calorie counts when discussing meals. "
        "Use emojis sparingly to highlight key points 🥗🍛."
    ),

    # ── Safety and disclaimer rules ───────────────────────────────
    "safety_rules": (
        "1. Always recommend consulting a registered dietitian or doctor "
        "   for medical conditions.\n"
        "2. Never diagnose medical conditions.\n"
        "3. Do not suggest extreme calorie restriction below 1200 kcal/day "
        "   for adults without a medical note.\n"
        "4. If a user mentions an eating disorder, respond with empathy and "
        "   direct them to professional help.\n"
        "5. Keep all advice culturally sensitive and non-judgmental.\n"
        "6. Do not recommend supplements without noting possible side effects."
    ),

    # ── Language preferences ──────────────────────────────────────
    "language": (
        "Respond in English by default. If the user writes in Hindi or "
        "Hinglish, mirror that style while keeping accuracy."
    ),

    # ── Conversation memory instruction ───────────────────────────
    "memory_instruction": (
        "Use the conversation history provided to give contextual, "
        "personalised responses. Remember user's dietary preferences, "
        "allergies, and family profiles mentioned earlier in the chat."
    ),
}


def build_system_prompt(user_profile: dict | None = None) -> str:
    """Assemble the full system prompt from AGENT_INSTRUCTIONS."""
    ins = AGENT_INSTRUCTIONS
    profile_section = ""
    if user_profile:
        profile_section = f"\n\n## Active User Profile\n{json.dumps(user_profile, indent=2)}"

    return f"""{ins['role']}

## Tone & Communication
{ins['tone']}

## Diet Specialisations
{chr(10).join('• ' + s for s in ins['diet_specialisations'])}

## Indian Food Expertise
{ins['indian_food_knowledge']}

## Output Style
{ins['output_style']}

## Safety Rules
{ins['safety_rules']}

## Language
{ins['language']}

## Memory & Context
{ins['memory_instruction']}
{profile_section}"""


# ─────────────────────────────────────────────────────────────────
#  Nutrition calculation helpers
# ─────────────────────────────────────────────────────────────────

def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    height_m = height_cm / 100
    bmi = weight_kg / (height_m ** 2)
    bmi = round(bmi, 1)
    if bmi < 18.5:
        category, color = "Underweight", "warning"
    elif bmi < 25:
        category, color = "Normal weight", "success"
    elif bmi < 30:
        category, color = "Overweight", "warning"
    else:
        category, color = "Obese", "danger"
    return {"bmi": bmi, "category": category, "color": color}


def calculate_tdee(weight_kg: float, height_cm: float,
                   age: int, gender: str, activity: str) -> dict:
    """Harris-Benedict BMR  →  TDEE."""
    if gender.lower() in ("male", "m"):
        bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age)

    activity_factors = {
        "sedentary":     1.2,
        "light":         1.375,
        "moderate":      1.55,
        "active":        1.725,
        "very_active":   1.9,
    }
    factor = activity_factors.get(activity.lower(), 1.55)
    tdee = round(bmr * factor)
    return {
        "bmr":  round(bmr),
        "tdee": tdee,
        "weight_loss":  tdee - 500,
        "weight_gain":  tdee + 500,
        "maintain":     tdee,
    }


def get_macro_split(goal: str, tdee: int) -> dict:
    """Return macro targets in grams for common goals."""
    splits = {
        "weight_loss":    {"protein": 0.30, "carbs": 0.40, "fat": 0.30},
        "muscle_gain":    {"protein": 0.35, "carbs": 0.45, "fat": 0.20},
        "maintenance":    {"protein": 0.25, "carbs": 0.50, "fat": 0.25},
        "keto":           {"protein": 0.30, "carbs": 0.05, "fat": 0.65},
        "balanced":       {"protein": 0.25, "carbs": 0.50, "fat": 0.25},
    }
    split = splits.get(goal.lower(), splits["balanced"])
    calories = tdee
    return {
        "protein_g": round((calories * split["protein"]) / 4),
        "carbs_g":   round((calories * split["carbs"])   / 4),
        "fat_g":     round((calories * split["fat"])     / 9),
        "calories":  calories,
    }


# ─────────────────────────────────────────────────────────────────
#  Watsonx inference
# ─────────────────────────────────────────────────────────────────

def build_prompt(system_prompt: str, history: list[dict], user_message: str) -> str:
    """Format a Granite-style chat prompt."""
    prompt = f"<|system|>\n{system_prompt}\n"
    for msg in history[-10:]:          # keep last 10 turns to save tokens
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prompt += f"<|{role}|>\n{content}\n"
    prompt += f"<|user|>\n{user_message}\n<|assistant|>\n"
    return prompt


def call_watsonx(system_prompt: str, history: list[dict],
                 user_message: str) -> str:
    try:
        model = get_watsonx_model()
        prompt = build_prompt(system_prompt, history, user_message)
        response = model.generate_text(prompt=prompt)
        return response.strip() if response else "I couldn't generate a response. Please try again."
    except Exception as exc:
        return f"⚠️ Watsonx error: {str(exc)}"


# ─────────────────────────────────────────────────────────────────
#  Flask routes
# ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html",
                           agent_name=AGENT_INSTRUCTIONS["agent_name"])


# ── Chat endpoint ────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data         = request.get_json(force=True)
    user_message = data.get("message", "").strip()
    history      = data.get("history", [])
    user_profile = data.get("profile", {})

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    system_prompt = build_system_prompt(user_profile)
    reply = call_watsonx(system_prompt, history, user_message)

    return jsonify({
        "reply":     reply,
        "timestamp": datetime.now().strftime("%H:%M"),
        "agent":     AGENT_INSTRUCTIONS["agent_name"],
    })


# ── BMI endpoint ─────────────────────────────────────────────────

@app.route("/api/bmi", methods=["POST"])
def bmi():
    data = request.get_json(force=True)
    try:
        weight = float(data["weight"])
        height = float(data["height"])
        result = calculate_bmi(weight, height)
        return jsonify(result)
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400


# ── TDEE / calorie needs endpoint ────────────────────────────────

@app.route("/api/tdee", methods=["POST"])
def tdee():
    data = request.get_json(force=True)
    try:
        weight   = float(data["weight"])
        height   = float(data["height"])
        age      = int(data["age"])
        gender   = str(data["gender"])
        activity = str(data["activity"])
        goal     = str(data.get("goal", "balanced"))

        tdee_data  = calculate_tdee(weight, height, age, gender, activity)
        macro_data = get_macro_split(goal, tdee_data["tdee"])

        return jsonify({**tdee_data, **macro_data, "goal": goal})
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400


# ── Meal plan generation ─────────────────────────────────────────

@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    data         = request.get_json(force=True)
    user_profile = data.get("profile", {})
    days         = int(data.get("days", 1))
    preferences  = data.get("preferences", "balanced Indian vegetarian")

    days = min(days, 7)           # cap at 7 days

    prompt = (
        f"Generate a detailed {days}-day Indian meal plan.\n"
        f"Preferences: {preferences}\n"
        f"Profile: {json.dumps(user_profile)}\n\n"
        "For each day include:\n"
        "- Breakfast with calories\n"
        "- Mid-morning snack\n"
        "- Lunch with calories\n"
        "- Evening snack\n"
        "- Dinner with calories\n"
        "- Daily total calories and macros\n\n"
        "Use Indian foods. Give portion sizes in practical Indian units "
        "(katoris, rotis, cups). Format with clear day headings."
    )

    system_prompt = build_system_prompt(user_profile)
    plan = call_watsonx(system_prompt, [], prompt)

    return jsonify({"plan": plan, "days": days})


# ── Family profile endpoint ───────────────────────────────────────

@app.route("/api/family-nutrition", methods=["POST"])
def family_nutrition():
    data    = request.get_json(force=True)
    members = data.get("members", [])

    if not members:
        return jsonify({"error": "No family members provided"}), 400

    members_text = "\n".join(
        f"- {m.get('name','Member')}: age {m.get('age','?')}, "
        f"gender {m.get('gender','?')}, goal {m.get('goal','healthy eating')}, "
        f"restrictions {m.get('restrictions','none')}"
        for m in members
    )

    prompt = (
        f"Create a family nutrition overview for:\n{members_text}\n\n"
        "For EACH member provide:\n"
        "1. Daily calorie target\n"
        "2. Key nutritional needs\n"
        "3. Three recommended Indian meals/snacks\n"
        "4. Any special dietary considerations\n\n"
        "Also suggest 2 common family meal options everyone can enjoy."
    )

    system_prompt = build_system_prompt()
    advice = call_watsonx(system_prompt, [], prompt)

    return jsonify({"advice": advice, "member_count": len(members)})


# ── Calorie analysis endpoint ─────────────────────────────────────

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data  = request.get_json(force=True)
    foods = data.get("foods", "")

    if not foods:
        return jsonify({"error": "No food items provided"}), 400

    prompt = (
        f"Analyse the nutritional content of:\n{foods}\n\n"
        "Provide:\n"
        "1. Calories per item and total\n"
        "2. Macros breakdown (protein, carbs, fat)\n"
        "3. Key micronutrients\n"
        "4. Healthier Indian alternatives if applicable\n"
        "5. Overall health rating (1-10) with explanation\n\n"
        "Be specific with Indian food portion sizes."
    )

    system_prompt = build_system_prompt()
    result = call_watsonx(system_prompt, [], prompt)

    return jsonify({"analysis": result})


# ── Quick tip / motivation endpoint ──────────────────────────────

@app.route("/api/tip", methods=["GET"])
def daily_tip():
    prompt = (
        "Give one concise, actionable Indian-food-focused nutrition tip "
        "for today. Max 3 sentences. Make it practical and positive."
    )
    tip = call_watsonx(build_system_prompt(), [], prompt)
    return jsonify({"tip": tip})


# ── Health check ─────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "agent":  AGENT_INSTRUCTIONS["agent_name"],
        "model":  os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"),
        "time":   datetime.now().isoformat(),
    })


# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    print(f"\n🥗  Nutrition Agent '{AGENT_INSTRUCTIONS['agent_name']}' starting on port {port}")
    print(f"   Model : {os.getenv('WATSONX_MODEL_ID', 'meta-llama/llama-3-3-70b-instruct')}")
    print(f"   Debug : {debug}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
