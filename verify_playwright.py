from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})

        # Go to the local server
        page.goto("http://localhost:8000")

        # Wait for the scene to initialize (the GLTF models take time)
        # We look for the "Initializing..." text to change or just wait
        time.sleep(10)

        # Take a screenshot
        page.screenshot(path="verify_game.png")
        browser.close()

if __name__ == "__main__":
    run()
