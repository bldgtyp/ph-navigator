## Run Locally:

- start docker
- `docker compose up -d`
- `alembic upgrade head`
- `cd backend`
- `uvicorn main:app --reload`

## Deployment:

Render.com | Web-service

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set Environment Variables (.env)
- [https://ph-dash-0cye.onrender.com](https://ph-dash-0cye.onrender.com)
- [API Docs](https://ph-dash-0cye.onrender.com/docs)
- Add a Custom Domain: [https://www.ph-nav.com](https://www.ph-nav.com)
