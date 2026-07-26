# assignments

## Tests

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt pytest-cov
.venv/bin/python -m pytest --cov=app --cov-report=term-missing
```

Cobertura mínima requerida: 80%.
