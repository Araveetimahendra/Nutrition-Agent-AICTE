# NutriBot – AI Nutrition Agent
### Powered by IBM Watsonx.ai Granite Models + Python Flask

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Conversational nutrition coaching with IBM Granite AI |
| 📊 **Dashboard** | Calorie & macro KPIs, pie chart, daily insights |
| 📅 **Meal Planner** | 1–7 day personalised Indian meal plans |
| ⚖️ **BMI Calculator** | BMI + TDEE + macro targets |
| 👨‍👩‍👧 **Family Profiles** | Multi-member family nutrition plans |
| 🔍 **Food Analyzer** | Detailed calorie & nutrient breakdown |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Mobile Responsive** | Works seamlessly on all screen sizes |

---

## 🏗️ Project Structure

```
Nutrition Agent/
├── app.py                  ← Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt        ← Python dependencies
├── .env.example            ← Environment variables template
├── .env                    ← Your actual credentials (never commit!)
├── .gitignore
├── templates/
│   └── index.html          ← Full frontend HTML
└── static/
    ├── style.css           ← Styles (dark mode, animations)
    └── app.js              ← All frontend interactivity
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10 or higher
- IBM Cloud account with Watsonx.ai access
- IBM Cloud API Key and Watsonx Project ID

### 2. Clone / Download

```bash
cd "Nutrition Agent"
```

### 3. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Credentials

Copy the example file and fill in your credentials:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Then open `.env` and update:

```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
FLASK_SECRET_KEY=change-this-to-a-random-string
```

### 6. Run the Application

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🔑 Getting IBM Credentials

### IBM Cloud API Key
1. Go to https://cloud.ibm.com/iam/apikeys
2. Click **Create an IBM Cloud API key**
3. Copy the key into `.env`

### Watsonx Project ID
1. Go to https://dataplatform.cloud.ibm.com
2. Open your Watsonx project → **Manage** tab
3. Copy the **Project ID** into `.env`

### Supported Granite Models

| Model ID | Best For |
|---|---|
| `ibm/granite-3-8b-instruct` | General nutrition advice (default) |
| `ibm/granite-3-2b-instruct` | Faster, lighter responses |
| `ibm/granite-13b-chat-v2`   | Richer, longer responses |

---

## 🎛️ Customising the Agent

All agent behaviour is controlled by the `AGENT_INSTRUCTIONS` dictionary in [`app.py`](app.py). 

**Edit these keys to customise:**

```python
AGENT_INSTRUCTIONS = {
    "agent_name":            "NutriBot",          # Change the bot name
    "tone":                  "...",               # Formal / casual / empathetic
    "role":                  "...",               # Core role description
    "diet_specialisations":  [...],               # Enable/disable specialisations
    "indian_food_knowledge": "...",               # Adjust regional focus
    "output_style":          "...",               # Format preferences
    "safety_rules":          "...",               # Medical safety constraints
    "language":              "...",               # Language preferences
    "memory_instruction":    "...",               # Conversation memory
}
```

**Examples:**

- Change to a **keto specialist**: add `"keto"` to diet_specialisations, update role
- Make it **formal/clinical**: change tone to `"professional, clinical, evidence-based"`
- Focus on **Bengali cuisine**: update indian_food_knowledge with regional details
- Add **allergy safety**: extend safety_rules with allergen warnings

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Main application UI |
| `/api/chat` | POST | Send message to AI agent |
| `/api/bmi` | POST | Calculate BMI |
| `/api/tdee` | POST | Calculate TDEE + macros |
| `/api/meal-plan` | POST | Generate meal plan |
| `/api/family-nutrition` | POST | Family nutrition advice |
| `/api/analyze` | POST | Food calorie analysis |
| `/api/tip` | GET | Daily nutrition tip |
| `/api/health` | GET | Health check |

### Example API Usage

```bash
# Chat
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I eat for breakfast?", "history": [], "profile": {}}'

# BMI
curl -X POST http://localhost:5000/api/bmi \
  -H "Content-Type: application/json" \
  -d '{"weight": 70, "height": 170}'

# Meal Plan
curl -X POST http://localhost:5000/api/meal-plan \
  -H "Content-Type: application/json" \
  -d '{"days": 3, "preferences": "South Indian vegetarian", "profile": {}}'
```

---

## 🚢 Production Deployment

### Option 1: Gunicorn (Linux/macOS)

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option 2: Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option 3: IBM Code Engine

```bash
# Install IBM Cloud CLI + Code Engine plugin, then:
ibmcloud ce project create --name nutribot-project
ibmcloud ce app create \
  --name nutribot \
  --image your-registry/nutribot:latest \
  --env-from-secret nutribot-secrets \
  --port 5000
```

### Option 4: Render / Railway

1. Push to GitHub (ensure `.env` is in `.gitignore`)
2. Connect repo to Render/Railway
3. Set environment variables in their dashboard
4. Deploy with `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`

---

## 🔒 Security Notes

- **Never commit `.env`** to version control — it's in `.gitignore`
- Rotate your IBM API key regularly
- In production, set `FLASK_ENV=production`
- Use HTTPS in production (reverse proxy with Nginx or cloud provider)

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| Flask | ≥3.0 | Web framework |
| flask-cors | ≥4.0 | CORS headers |
| python-dotenv | ≥1.0 | `.env` loading |
| ibm-watsonx-ai | ≥1.1.2 | IBM Granite AI |
| requests | ≥2.31 | HTTP client |
| gunicorn | ≥21.2 | Production server |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## ⚠️ Disclaimer

NutriBot is an AI-powered educational tool and **not a substitute for medical advice**. Always consult a registered dietitian or physician for personalised medical dietary guidance.

---

*Built with ❤️ using IBM Watsonx.ai Granite Models*
