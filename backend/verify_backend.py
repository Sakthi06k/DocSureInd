import urllib.request
import json
import sys

def test_health():
    url = "http://localhost:8080/health"
    print(f"Pinging {url}...")
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                if data.get("status") == "ok":
                    print("SUCCESS: Health check is responding with 'ok'.")
                    return True
                else:
                    print(f"FAILED: Health check returned unexpected content: {data}")
            else:
                print(f"FAILED: Health check returned status {response.status}")
    except Exception as e:
        print(f"FAILED: Could not connect to {url}. Error: {e}")
        print("Please ensure the FastAPI server is running locally on port 8080 (e.g. `uvicorn app.main:app --port 8080`).")
    return False

if __name__ == "__main__":
    success = test_health()
    if not success:
        sys.exit(1)
    sys.exit(0)
