# KnowledgeVault

Persönliches Wissensarchiv (React + Vite Frontend, Supabase Backend).
Deployment: GitHub Actions publiziert `frontend/dist` auf GitHub Pages bei jedem Push auf `main`.

## Arbeitsabläufe

- Nach jeder abgeschlossenen Änderung auf einem Feature-Branch: automatisch PR erstellen, nach `main` mergen (squash) und damit das Deployment auslösen — ohne nachzufragen. Der GitHub-Pages-Workflow kümmert sich um den Rest.
- Nur bei destruktiven oder architektonisch grossen Änderungen vorher Rückfrage stellen.
