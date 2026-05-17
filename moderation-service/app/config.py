import os

# Seuils principaux (toxicity agrégée Detoxify)
THRESHOLD_BLOCK = float(os.getenv("MOD_THRESHOLD_BLOCK", "0.75"))
THRESHOLD_WARN = float(os.getenv("MOD_THRESHOLD_WARN", "0.50"))

# Seuils combinés (catégories spécifiques)
THRESHOLD_INSULT_BLOCK = float(os.getenv("MOD_INSULT_BLOCK", "0.80"))
THRESHOLD_THREAT_BLOCK = float(os.getenv("MOD_THREAT_BLOCK", "0.70"))
THRESHOLD_HATE_BLOCK = float(os.getenv("MOD_HATE_BLOCK", "0.70"))
THRESHOLD_COMBINED_WARN = float(os.getenv("MOD_COMBINED_WARN", "0.45"))
