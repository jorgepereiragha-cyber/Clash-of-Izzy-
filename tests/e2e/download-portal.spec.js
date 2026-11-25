import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const releases = "https://api.github.com/repos/jorgepereiragha-cyber/Clash-of-Izzy-/releases/latest";
const prefix = "https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/v1.2.3/";
const apk = "clash-of-izzy-android.apk";
test.beforeEach(async ({page})=>{
  await page.route("https://api.github.com/repos/jorgepereiragha-cyber/Clash-of-Izzy-/releases?per_page=100",route=>route.fulfill({status:200,headers:{"access-control-allow-origin":"*"},contentType:"application/json",body:"[]"}));
});

test("Android: marketing homepage promotes gated APK, not browser gameplay", async ({ page }) => {
  await page.route(releases, route => route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/portal(?:\.html)?$/);
  await expect(page.locator("h1")).toContainText("CLASH OF IZZY");
  await expect(page.locator(".tagline")).toHaveText("Construa. Lute. Reine.");
  for(const id of ["download-apk","download-invite"]) {
    const button = page.locator("#" + id);
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).not.toHaveAttribute("href", /./);
  }
  await expect(page.locator("#play-browser,a[href*='kingdom.html']")).toHaveCount(0);
  await expect(page.locator(".feature-card,.gallery-grid,.shot-placeholder")).toHaveCount(0);
  await expect(page.locator("details")).toHaveJSProperty("open", false);
  await expect(page.getByText("O APK comercial ainda não está disponível")).toBeVisible();
});

test("Android: only signed release names on official GitHub download host are offered", async ({ page }) => {
  await page.route(releases, route => route.fulfill({
    status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json",
    body: JSON.stringify({
      draft: false, prerelease: false, tag_name: "v1.2.3",
      assets: [
        { name: apk, state: "uploaded", size: 4000000, browser_download_url: prefix + apk },
        { name: apk + ".sha256", state: "uploaded", size: 96, browser_download_url: prefix + apk + ".sha256" }
      ]
    })
  }));
  await page.goto("/portal.html");
  const download = page.locator("#download-apk");
  await expect(download).toHaveAttribute("href", prefix + apk);
  await expect(download).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#checksum-link")).toHaveAttribute("href", prefix + apk + ".sha256");
  await expect(page.getByText("Versão v1.2.3 disponível")).toBeVisible();
  await expect(page.locator("#download-status")).toContainText("Versão v1.2.3 disponível");
});

test("Android: reject download redirection to another domain even if release metadata contains an asset", async ({ page }) => {
  await page.route(releases, route => route.fulfill({
    status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json",
    body: JSON.stringify({
      draft: false, prerelease: false, tag_name: "v1.2.3",
      assets: [
        { name: apk, state: "uploaded", size: 4000000, browser_download_url: "https://evil.example/app.apk" },
        { name: apk + ".sha256", state: "uploaded", size: 96, browser_download_url: prefix + apk + ".sha256" }
      ]
    })
  }));
  await page.goto("/portal.html");
  await expect(page.locator("#download-status")).toContainText("O APK comercial ainda não está disponível");
  await expect(page.locator("#download-apk")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#download-apk")).not.toHaveAttribute("href", /./);
});

test("Android: reject incorrect asset paths and duplicated release assets", async ({page})=>{
  let assets = [
    {name:apk,state:"uploaded",size:4000000,browser_download_url:prefix+apk+"/extra"},
    {name:apk+".sha256",state:"uploaded",size:96,browser_download_url:prefix+apk+".sha256"}
  ];
  await page.route(releases,route=>route.fulfill({status:200,headers:{"access-control-allow-origin":"*"},contentType:"application/json",body:JSON.stringify({draft:false,prerelease:false,tag_name:"v1.2.3",assets})}));
  await page.goto("/portal.html");
  await expect(page.locator("#download-status")).toContainText("O APK comercial ainda não está disponível");
  await expect(page.locator("#download-apk")).not.toHaveAttribute("href",/./);
  assets=[{...assets[0],browser_download_url:prefix+apk},{...assets[0],browser_download_url:prefix+apk},assets[1]];
  await page.reload();
  await expect(page.locator("#download-status")).toContainText("O APK comercial ainda não está disponível");
  await expect(page.locator("#download-apk")).not.toHaveAttribute("href",/./);
});

test("Android: compact responsive hero and accessible secondary details",async({page})=>{
  // Real portal markup, with mocked release metadata; evidence is not a production screenshot.
  const evidenceDir = join(process.cwd(), "test-results", "visual-preview", "portal");
  await mkdir(evidenceDir, {recursive:true});
  await page.route(releases,route=>route.fulfill({status:404,headers:{"access-control-allow-origin":"*"},body:"{}"}));
  for(const [width,height] of [[360,800],[390,844],[412,915],[844,390],[1440,900]]){
    await page.setViewportSize({width,height});
    await page.goto("/portal.html");
    await expect(page.locator("#download-status")).toContainText("O APK comercial ainda não está disponível");
    await expect(page.locator("#invite-download-status")).toContainText("Instalador por convite ainda indisponível");
    await expect(page.locator("#download-apk")).toBeInViewport({ratio:0.9});
    await expect(page.locator("h1")).toBeInViewport({ratio:0.9});
    await expect.poll(()=>page.locator(".crest").evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidenceDir,`portal-${width}x${height}-downloads-indisponiveis.png`),animations:"disabled"});
    await page.locator("summary").focus();
    await expect(page.locator("summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#official-release-page")).toBeVisible();
    await expect(page.locator("details")).toHaveJSProperty("open",true);
    await page.screenshot({path:join(evidenceDir,`portal-${width}x${height}-detalhes.png`),fullPage:true,animations:"disabled"});
  }
});

test("Android: invite APK remains visible when commercial release is unavailable",async({page})=>{
 await page.route(releases,route=>route.fulfill({status:404,headers:{"access-control-allow-origin":"*"},body:"{}"}));
 const inviteName="clash-of-izzy-access.apk", tag="android-access-v11";
 const base="https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/"+tag+"/";
 await page.route("https://api.github.com/repos/jorgepereiragha-cyber/Clash-of-Izzy-/releases?per_page=100",route=>route.fulfill({status:200,headers:{"access-control-allow-origin":"*"},contentType:"application/json",body:JSON.stringify([{draft:false,prerelease:true,tag_name:tag,assets:[inviteName,inviteName+".sha256"].map(name=>({name,state:"uploaded",size:100,browser_download_url:base+name}))}])}));
 await page.goto("/portal.html");
 await expect(page.locator("#download-invite")).toBeVisible();
 await expect(page.locator("#download-invite")).toHaveAttribute("href",base+inviteName);
 await expect(page.locator("#download-apk")).not.toBeVisible();
 await page.locator("summary").click();
 await expect(page.locator("#invite-checksum")).toHaveAttribute("href",base+inviteName+".sha256");
});
