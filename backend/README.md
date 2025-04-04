## Run Locally:
- `cd backend`
- `uvicorn main:app --reload`

## Deployment:
Render.com | Webservice
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set Environment Variables (.env)
- [https://ph-dash-0cye.onrender.com](https://ph-dash-0cye.onrender.com)
- [API Docs](https://ph-dash-0cye.onrender.com/docs)