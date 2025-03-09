from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from pyairtable import Api
from pyairtable.api.types import RecordDict

load_dotenv()


# Sackett Room Data
# https://airtable.com/app64a1JuYVBs7Z1m/tblHB8tkzHso1tfYU/viw7REP61sRyUvbQV?blocks=hide
AIRTABLE_API_KEY = str(os.getenv("AIRTABLE_API_KEY"))
AIRTABLE_BASE_ID = str(os.getenv("AIRTABLE_BASE_ID"))
AIRTABLE_TABLE_NAME = "tblapLjAFgm7RIllz"


app = FastAPI()


origins = [
    "http://localhost:3000",
    "localhost:3000",
    "https://ph-tools.github.io",
    "https://bldgtyp.github.io",
    "https://ph-dash-frontend.onrender.com",
    "https://ph-dash-0cye.onrender.com",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/data")
def get_data() -> list[RecordDict]:
    api = Api(AIRTABLE_API_KEY)
    print(f"using API key {AIRTABLE_API_KEY}")
    print(f"Getting Data from {AIRTABLE_BASE_ID} | {AIRTABLE_TABLE_NAME}")
    table = api.table(
        base_id=AIRTABLE_BASE_ID,
        table_name=AIRTABLE_TABLE_NAME
    )
    data = table.all()
    print(f"Data: {data}")
    return data