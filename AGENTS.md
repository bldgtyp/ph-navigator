# Project Guide for Codex

## Project:

PH-Navigator is a webapp for viewing and managing project-data for 'Passive House' buildings during design. Some data is 'view-only' and loads from an external 'AirTable' database, while other data allows for edits and uses a hosted Postgres database

## Project Structure

See `context/app.md` for details about this app.

- `/backend` - FastAPI Server with routes and Database
- `/fronted` - React Components
- `/context` - MD files with full app details and references

## Frontend:

- Typescript / React
- Run Prettier (`npm run format`) after all changes.
- See `context/frontend.md` for details
- Restricted to 'display' and UI/UX elements

## Backend:

- Python / FastAPI
- See `context/backend.md` for details
- Uses Pydantic v2. Use `ConfigDict`, `field_validator`, `model_validator`, `.model_validate()`, `.model_dump()` (not v1 syntax).
- Calcuations and any 'manipulation' of data.

## Database:

- Postgres running in Docker for local-dev
- See `context/database.md` for details

## PLANNING:

- ALL Planning documents should be saved as Markdown (.MD) files in the project `docs/plans/...` directory
- When generating a Plan, add a 'TIME' and 'DATE' marker at the front for cataloging.

## NEW CODE:

- When adding new code, wherever possible attempt to RE-USE existing functions, classes, and types.
- Wherever possible, any NEW CODE should match and aign with the design-patterns of EXISTING code.
- Prioritize cleanliness and consistency over speed. Take your time and review existing code before adding anything new.
- All 'calculations' should always be done in the 'Backend'. the 'Frontend' is purely for display and User-Interactions.
