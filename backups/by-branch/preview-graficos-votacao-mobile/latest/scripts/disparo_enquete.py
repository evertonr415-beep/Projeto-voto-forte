import json
import urllib.request
import urllib.error
import time
import os

PHONE_NUMBER_ID = "1319478581243565"

def get_token():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("META_WA_ACCESS_TOKEN="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("META_WA_ACCESS_TOKEN", "")

NUMBERS = [
    "5543998037541",
    "5543996100248",
    "5543996098821",
    "5543999125154",
    "5543999868065",
    "5561983197408",
    "5543999709710"
]

MESSAGE_BODY = """Olá! Tudo bem?

Estamos realizando uma rápida enquete cidadã para ouvir a população sobre as prioridades e o futuro de Arapongas.

Sua opinião é fundamental e leva menos de 1 minuto para responder. Acesse pelo link:
https://voto-forte-parana.vercel.app/enquete/arapongas"""

def send_message(phone, token):
    url = f"https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "text",
        "text": {
            "preview_url": True,
            "body": MESSAGE_BODY
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            res_body = resp.read().decode("utf-8")
            return True, json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return False, json.loads(err_body)
        except Exception:
            return False, {"error": err_body}
    except Exception as e:
        return False, {"error": str(e)}

def main():
    token = get_token()
    print(f"Testando envio com token: {token[:15]}...{token[-10:]}")
    
    # Testa primeiro com o primeiro número
    success, res = send_message(NUMBERS[0], token)
    if not success:
        print("❌ Falha na autenticação ou envio:")
        print(json.dumps(res, indent=2))
        return

    print(f"✅ Sucesso para {NUMBERS[0]}: {res}")
    
    # Continua para os demais
    for phone in NUMBERS[1:]:
        time.sleep(1)
        ok, r = send_message(phone, token)
        if ok:
            print(f"✅ Enviado para {phone}: {r.get('messages', [{}])[0].get('id')}")
        else:
            print(f"❌ Erro para {phone}: {r}")

if __name__ == "__main__":
    main()
