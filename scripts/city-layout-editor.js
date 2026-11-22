/* Editor de layout 2D: prévia local; apenas o Worker decide e persiste a posição. */
const root = document.getElementById("coiCityLayout");
if (root) {
  const canvas = document.getElementById("coiCityGrid");
  const ctx = canvas.getContext("2d");
  const selector = document.getElementById("coiCityBuilding");
  const xInput = document.getElementById("coiCityX");
  const zInput = document.getElementById("coiCityZ");
  const submit = document.getElementById("coiCityMove");
  const status = document.getElementById("coiCityGridStatus");
  const config = () => window.__coiCityLayoutState?.()?.cityLayout;
  const buildings = () => window.__coiCityLayoutState?.()?.buildings || [];
  const selected = () => buildings().find(item => item.building_type === selector.value);
  let moving = false;

  function draw() {
    const layout = config(), rows = buildings();
    if (!layout || !ctx) return;
    const min = layout.min, tiles = layout.max - layout.min;
    const unit = canvas.width / tiles;
    const current = selected();
    const x = Number(xInput.value), z = Number(zInput.value);
    const size = layout.footprints[selector.value];
    const valid = isValid(x, z, current, rows, layout);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#253c33";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(220,211,155,.13)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= tiles; i += 5) {
      const p = i * unit;
      ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,canvas.height);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(canvas.width,p);ctx.stroke();
    }
    rows.forEach(b => {
      const fp = layout.footprints[b.building_type];
      if (!fp) return;
      const px = (Number(b.position_x) - min) * unit;
      const py = (Number(b.position_z) - min) * unit;
      ctx.fillStyle = b.building_type === selector.value ? "#cfb05d" : "#53799a";
      ctx.fillRect(px,py,fp.width*unit,fp.height*unit);
      ctx.strokeStyle = "#e8e0c5";
      ctx.strokeRect(px,py,fp.width*unit,fp.height*unit);
    });
    if (size && Number.isFinite(x) && Number.isFinite(z)) {
      ctx.fillStyle = valid ? "rgba(85,225,135,.42)" : "rgba(244,88,88,.53)";
      ctx.fillRect((x-min)*unit,(z-min)*unit,size.width*unit,size.height*unit);
      ctx.strokeStyle = valid ? "#8ef0af" : "#ff8585";
      ctx.lineWidth = 2;
      ctx.strokeRect((x-min)*unit,(z-min)*unit,size.width*unit,size.height*unit);
    }
    submit.disabled = moving || !valid || !current ||
      (Number(current.position_x) === x && Number(current.position_z) === z);
    if (!moving) status.textContent = !current ? "Aguardando a cidade" :
      valid ? "Prévia livre. Confirme para salvar a posição no servidor." :
      "Posição inválida ou ocupada. Escolha outro ponto.";
  }

  function isValid(x,z,current,rows,layout) {
    const fp = layout?.footprints?.[current?.building_type];
    if (!fp || !Number.isSafeInteger(x) || !Number.isSafeInteger(z) ||
      x < layout.min || z < layout.min ||
      x + fp.width > layout.max || z + fp.height > layout.max) return false;
    return rows.every(other => {
      if (other.building_type === current.building_type) return true;
      const footprint = layout.footprints[other.building_type];
      if (!footprint) return false;
      const ox = Number(other.position_x), oz = Number(other.position_z);
      return !(x < ox + footprint.width && x + fp.width > ox &&
        z < oz + footprint.height && z + fp.height > oz);
    });
  }

  function refresh() {
    const rows = buildings(), previous = selector.value;
    if (!rows.length || !config()) return;
    if (selector.options.length !== rows.length ||
        rows.some(row => !Array.from(selector.options).some(option => option.value === row.building_type))) {
      selector.replaceChildren();
      rows.forEach(row => {
        const option = document.createElement("option");
        option.value = row.building_type;
        option.textContent = (window.__coiCityBuildingNames?.[row.building_type] || row.building_type) + " · Nv. " + row.level;
        selector.appendChild(option);
      });
    }
    if (rows.some(b => b.building_type === previous)) selector.value = previous;
    const chosen = selected();
    if (chosen) {
      xInput.value = String(Math.round(Number(chosen.position_x)));
      zInput.value = String(Math.round(Number(chosen.position_z)));
    }
    draw();
  }

  selector.addEventListener("change", () => {
    const b = selected();
    if (b) { xInput.value = String(Math.round(Number(b.position_x))); zInput.value = String(Math.round(Number(b.position_z))); }
    draw();
  });
  xInput.addEventListener("input",draw);
  zInput.addEventListener("input",draw);
  canvas.addEventListener("pointerdown",event => {
    if (!selected() || moving) return;
    const rect = canvas.getBoundingClientRect();
    const layout = config();
    if (!layout || !rect.width || !rect.height) return;
    const tiles = layout.max - layout.min;
    xInput.value = String(Math.floor((event.clientX - rect.left) / rect.width * tiles) + layout.min);
    zInput.value = String(Math.floor((event.clientY - rect.top) / rect.height * tiles) + layout.min);
    draw();
  });
  submit.addEventListener("click",async () => {
    const b = selected();
    const x = Number(xInput.value), z = Number(zInput.value);
    if (moving || !b || !isValid(x,z,b,buildings(),config())) return;
    moving = true; submit.disabled = true; status.textContent = "Salvando o layout...";
    try {
      if (typeof window.__coiCityLayoutMove !== "function") throw new Error("Jogo não está pronto para salvar.");
      await window.__coiCityLayoutMove({
        building:b.building_type,gridX:x,gridZ:z,
        fromX:Number(b.position_x),fromZ:Number(b.position_z)
      });
      status.textContent = "Edifício reposicionado e sincronizado.";
    } catch(error) {
      status.textContent = String(error?.message || "Falha ao salvar a posição.");
      refresh();
    } finally {
      moving = false;
      draw();
    }
  });
  window.addEventListener("coi:kingdom-render",refresh);
  root.addEventListener("toggle",() => { if(root.open) refresh(); });
  refresh();
}
