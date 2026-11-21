import sys

from playwright.sync_api import expect, sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(sys.argv[1])
    expect(page.get_by_role("heading", name="ContextDesk")).to_be_visible()
    page.get_by_role("textbox", name="Workspace name").fill("Browser workspace")
    page.get_by_role("button", name="Create workspace").click()
    expect(page.get_by_label("Workspace", exact=True)).to_contain_text("Browser workspace")
    page.get_by_label("Document file").set_input_files({
        "name": "shipping.txt",
        "mimeType": "text/plain",
        "buffer": b"Shipping labels can be printed from the dispatch screen.",
    })
    page.get_by_role("button", name="Upload", exact=True).click()
    expect(page.get_by_text("ready", exact=True)).to_be_visible(timeout=15_000)
    page.get_by_role("textbox", name="Search or ask a question").fill("dispatch")
    page.get_by_role("button", name="Search", exact=True).click()
    expect(page.get_by_text("Shipping labels can be printed from the dispatch screen.")).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role("link", name="[1] shipping.txt", exact=True).click()
    assert download.value.suggested_filename == "shipping.txt"
    page.get_by_role("textbox", name="Ticket title").fill("Printer question")
    page.get_by_role("textbox", name="Description").fill("Where do we print shipping labels?")
    page.get_by_role("button", name="Create ticket").click()
    expect(page.get_by_role("heading", name="Printer question")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.set_viewport_size({"width": 1280, "height": 800})
    expect(page.get_by_role("heading", name="Printer question")).to_be_visible()
    browser.close()
    print("Browser smoke test passed")
