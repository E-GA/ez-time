const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYqQe9Ev227ki0Pocio-z-X4vaM37NPI55HipVqdSGmNXuqI2Ix7jQawcEMEG8Cgsn/exec";

let employees = [];
let workLogs = [];
let workPlans = [];
let currentUser = null;
let workModal = null;

window.onload = async function () {
  workModal = new bootstrap.Modal(document.getElementById("editWorkModal"));
  await fetchAllData();

  const savedUsername = localStorage.getItem("ega_current_username");
  if (savedUsername) {
    currentUser = employees.find(e => e.username === savedUsername);
    if (currentUser) {
      showPage("userPage");
      renderUserDashboard();
    }
  }
};

function showLoading(status) {
  console.log(status ? "กำลังโหลด..." : "โหลดเสร็จ");
}

function formatDateOnly(value) {
  if (!value) return "-";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[0];
  return text.substring(0, 10);
}

async function fetchAllData() {
  showLoading(true);

  try {
    const [eRes, lRes, pRes] = await Promise.all([
      fetch(SCRIPT_URL + "?action=getEmployees"),
      fetch(SCRIPT_URL + "?action=getLogs"),
      fetch(SCRIPT_URL + "?action=getPlans")
    ]);

    employees = await eRes.json();
    workLogs = await lRes.json();
    workPlans = await pRes.json();

    employees = employees.map(e => ({
      ...e,
      id: Number(e.id)
    }));

    workLogs = workLogs.map(l => ({
      ...l,
      id: Number(l.id),
      empId: Number(l.empId),
      date: formatDateOnly(l.date),
      rate: Number(l.rate || 0),
      fund: Number(l.fund || 0),
      hours: Number(l.hours || 0),
      total: Number(l.total || 0)
    }));

    workPlans = workPlans.map(p => ({
      ...p,
      id: Number(p.id)
    }));

    renderPublicPlans();

  } catch (err) {
    console.error("โหลดข้อมูลไม่สำเร็จ:", err);
    alert("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ");
  }

  showLoading(false);
}

async function syncData(sheetName, dataArray) {
  if (!Array.isArray(dataArray)) return;

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        sheet: sheetName,
        data: dataArray
      })
    });

    console.log("บันทึกลง Google Sheet:", sheetName);

  } catch (error) {
    console.error("บันทึกไม่สำเร็จ:", error);
    alert("บันทึกข้อมูลไม่สำเร็จ");
  }
}

async function saveData(sheetName) {
  localStorage.setItem("ez_v4_emp", JSON.stringify(employees));
  localStorage.setItem("ez_v4_logs", JSON.stringify(workLogs));
  localStorage.setItem("ez_v4_plans", JSON.stringify(workPlans));

  if (sheetName === "employees") await syncData("employees", employees);
  if (sheetName === "workLogs") await syncData("workLogs", workLogs);
  if (sheetName === "workPlans") await syncData("workPlans", workPlans);
}

async function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();

  if (!u || !p) {
    alert("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    return;
  }

  const res = await fetch(
    SCRIPT_URL +
    "?action=login&username=" + encodeURIComponent(u) +
    "&password=" + encodeURIComponent(p)
  );

  const data = await res.json();

  if (!data.success) {
    alert("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    return;
  }

  if (data.role === "admin") {
    localStorage.removeItem("ega_current_username");
    showPage("adminPage");
    updateAdminUI();
    renderAdminDashboard();
    renderAdminPlans();
    return;
  }

  currentUser = employees.find(e => e.username === u);

  if (!currentUser) {
    alert("โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ");
    return;
  }

  localStorage.setItem("ega_current_username", currentUser.username);
  showPage("userPage");
  renderUserDashboard();
}

function showPage(id) {
  document.querySelectorAll(".container > div").forEach(d => d.classList.add("hidden"));
  document.getElementById("mainNav").classList.remove("hidden");
  document.getElementById(id).classList.remove("hidden");
}

function logout() {
  localStorage.removeItem("ega_current_username");
  location.reload();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function resizeProfileImage(dataUrl, maxSize = 900, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => reject(new Error("ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้"));
    img.src = dataUrl;
  });
}

function getDataUrlMimeType(dataUrl) {
  const match = String(dataUrl).match(/^data:(.*?);base64,/);
  return match ? match[1] : "image/jpeg";
}

function getDriveFileId(url) {
  const text = String(url || "");
  const queryMatch = text.match(/[?&]id=([^&]+)/);
  const pathMatch = text.match(/\/d\/([^/]+)/);
  const id = queryMatch ? queryMatch[1] : pathMatch ? pathMatch[1] : "";

  return id ? decodeURIComponent(id) : "";
}

function normalizePhotoUrl(url) {
  const fileId = getDriveFileId(url);
  if (!fileId) return url;

  return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w320";
}

async function uploadPhoto(input) {

  if (!currentUser) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  if (!input.files || !input.files[0]) return;

  const file = input.files[0];

  if (!file.type.startsWith("image/")) {
    alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    alert("รูปใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 8MB");
    input.value = "";
    return;
  }

  input.disabled = true;

  try {
    const originalDataUrl = await readFileAsDataURL(file);
    const imgData = await resizeProfileImage(originalDataUrl);
    const base64 = imgData.split(",")[1];
    const mimeType = getDataUrlMimeType(imgData);
    const previousPhoto = currentUser.photo || "";

    document.getElementById("uProfileImg").src = imgData;

    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "uploadPhoto",
        empId: currentUser.id,
        fileName: "emp_" + currentUser.id + ".jpg",
        mimeType: mimeType,
        base64: base64
      })
    });

    for (let i = 0; i < 4; i++) {
      await wait(1500);
      try {
        await fetchAllData();
      } catch (err) {
        console.warn("รีเฟรชข้อมูลรูปยังไม่สำเร็จ:", err);
      }

      const updatedUser = employees.find(e => Number(e.id) === Number(currentUser.id));
      const updatedPhoto = updatedUser ? updatedUser.photo || "" : "";

      if (updatedPhoto && updatedPhoto !== previousPhoto) {
        currentUser = updatedUser;
        document.getElementById("uProfileImg").src = normalizePhotoUrl(updatedPhoto);
        alert("อัปโหลดรูปโปรไฟล์สำเร็จ");
        return;
      }
    }

    alert("ส่งรูปแล้ว แต่ยังไม่พบลิงก์รูปในระบบ กรุณาลองรีเฟรชหรือเข้าสู่ระบบใหม่อีกครั้ง");

  } catch (err) {
    console.error(err);
    alert("อัปโหลดรูปไม่สำเร็จ: " + err.message);

  } finally {
    input.disabled = false;
    input.value = "";
  }
}
async function updateUserAccount() {
  const newBank = document.getElementById("uInputBank").value;
  const newAcc = document.getElementById("uInputAcc").value.trim();

  if (!newBank || !newAcc) return alert("กรุณาระบุธนาคารและเลขบัญชี");

  currentUser.bank = newBank;
  currentUser.acc = newAcc;

  const idx = employees.findIndex(e => Number(e.id) === Number(currentUser.id));
  if (idx !== -1) {
    employees[idx].bank = newBank;
    employees[idx].acc = newAcc;
  }

  await saveData("employees");
  alert("บันทึกข้อมูลบัญชีสำเร็จ");
}

function updateAdminUI() {
  const select = document.getElementById("selectEmp");
  select.innerHTML = '<option value="">-- เลือกพนักงาน --</option>';

  employees.forEach(e => {
    select.innerHTML += `<option value="${e.id}">${e.name}</option>`;
  });

  const empList = document.getElementById("adminEmpList");
  empList.innerHTML = '<h6 class="fw-bold border-bottom pb-2">รายชื่อพนักงาน</h6>';

  employees.forEach(e => {
    empList.innerHTML += `
      <div class="mb-2 p-2 border rounded bg-white shadow-sm d-flex justify-content-between align-items-center">
        <div>
          <b>${e.name}</b><br>
          <small class="text-muted">User: ${e.username}</small><br>
          <small class="text-primary">${e.bank || "-"} ${e.acc || ""}</small>
        </div>
        <div>
          <i class="bi bi-pencil-square me-2" style="cursor:pointer" onclick="editEmployeeAdmin(${e.id})"></i>
          <i class="bi bi-trash text-danger" style="cursor:pointer" onclick="deleteEmployee(${e.id})"></i>
        </div>
      </div>`;
  });
}

async function editEmployeeAdmin(id) {
  const emp = employees.find(e => Number(e.id) === Number(id));
  if (!emp) return;

  const n = prompt("ชื่อ-นามสกุล:", emp.name);
  const b = prompt("ธนาคาร:", emp.bank || "");
  const a = prompt("เลขบัญชี:", emp.acc || "");
  const u = prompt("Username ล็อกอิน:", emp.username);
  const p = prompt("รหัสผ่านใหม่ ถ้าไม่เปลี่ยนให้เว้นว่าง:", "");

  if (n) emp.name = n;
  if (b) emp.bank = b;
  if (a) emp.acc = a;
  if (u) emp.username = u;
  if (p) emp.password = p;

  await saveData("employees");
  updateAdminUI();
  renderAdminDashboard();
}

function renderAdminDashboard() {
  renderAdminPendingSummary();

  const tbody = document.getElementById("adminReportBody");
  tbody.innerHTML = "";

  [...workLogs].reverse().forEach(log => {
    const emp = employees.find(e => Number(e.id) === Number(log.empId)) || { name: "N/A", bank: "-", acc: "-" };

    tbody.innerHTML += `
      <tr>
        <td><small>${formatDateOnly(log.date)}</small><br><b>${emp.name}</b></td>
        <td>
          <span class="badge bg-light text-dark border">${emp.bank || "-"}</span><br>
          <span class="text-primary fw-bold">${emp.acc || "-"}</span>
        </td>
        <td>${Number(log.hours || 0)} ชม.</td>
        <td class="fw-bold">${Number(log.total || 0).toLocaleString()}</td>
        <td>
          <span class="status-badge ${log.status === "paid" ? "status-badge-paid" : "status-badge-pending"}">
            ${log.status === "paid" ? "จ่ายแล้ว" : "รอ"}
          </span>
        </td>
        <td>
          <i class="bi bi-check-circle-fill text-success me-2 fs-5" style="cursor:pointer" onclick="togglePay(${log.id})"></i>
          <i class="bi bi-pencil fs-5 me-2" style="cursor:pointer" onclick="openEditWork(${log.id})"></i>
          <i class="bi bi-trash text-danger fs-5" style="cursor:pointer" onclick="deleteWorkLog(${log.id})"></i>
        </td>
      </tr>`;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAdminPendingSummary() {
  const totalEl = document.getElementById("adminPendingTotal");
  const peopleEl = document.getElementById("adminPendingPeople");

  if (!totalEl || !peopleEl) return;

  const pendingByEmp = new Map();
  let pendingTotal = 0;

  workLogs
    .filter(log => log.status !== "paid")
    .forEach(log => {
      const empId = Number(log.empId);
      const amount = Number(log.total || 0) || 0;
      const current = pendingByEmp.get(empId) || {
        empId,
        amount: 0,
        count: 0
      };

      current.amount += amount;
      current.count += 1;
      pendingByEmp.set(empId, current);
      pendingTotal += amount;
    });

  totalEl.innerText = pendingTotal.toLocaleString() + " ฿";

  const rows = [...pendingByEmp.values()]
    .filter(item => item.amount !== 0 || item.count > 0)
    .sort((a, b) => b.amount - a.amount);

  if (!rows.length) {
    peopleEl.innerHTML = `
      <div class="admin-empty-summary">
        <i class="bi bi-check2-circle"></i>
        <span>ไม่มีรายการรอจ่าย</span>
      </div>`;
    return;
  }

  peopleEl.innerHTML = rows.map(item => {
    const emp = employees.find(e => Number(e.id) === Number(item.empId));
    const name = emp ? emp.name : "ไม่พบชื่อพนักงาน";
    const bankText = emp && (emp.bank || emp.acc)
      ? `${emp.bank || "-"} ${emp.acc || ""}`.trim()
      : "-";

    return `
      <div class="admin-pending-row">
        <div>
          <div class="admin-pending-name">${escapeHtml(name)}</div>
          <div class="admin-pending-meta">${escapeHtml(bankText)} | ${item.count} รายการ</div>
        </div>
        <strong>${item.amount.toLocaleString()} ฿</strong>
      </div>`;
  }).join("");
}

function renderPublicPlans() {
  const list = document.getElementById("loginPlanList");
  list.innerHTML = workPlans.length
    ? workPlans.map(p => `<div class="mb-2 border-bottom pb-1 small"><i class="bi bi-calendar-event"></i> ${p.text}</div>`).join("")
    : "ยังไม่มีประกาศ";
}

function renderAdminPlans() {
  const list = document.getElementById("adminPlanList");
  list.innerHTML = workPlans.map(p => `
    <div class="d-flex justify-content-between mb-2 p-2 border rounded small bg-white">
      <span>${p.text}</span>
      <i class="bi bi-trash text-danger" style="cursor:pointer" onclick="deletePlan(${p.id})"></i>
    </div>`).join("");
}

async function addWorkPlan() {
  const t = document.getElementById("planText").value.trim();
  if (!t) return;

  workPlans.push({ id: Date.now(), text: t });
  document.getElementById("planText").value = "";

  await saveData("workPlans");
  renderAdminPlans();
  renderPublicPlans();
}

async function deletePlan(id) {
  if (!confirm("ลบแผนงานนี้?")) return;

  workPlans = workPlans.filter(p => Number(p.id) !== Number(id));
  await saveData("workPlans");

  renderAdminPlans();
  renderPublicPlans();
}

async function addEmployee() {
  const n = document.getElementById("empName").value.trim();
  const b = document.getElementById("empBank").value;
  const a = document.getElementById("empAcc").value.trim();

  if (!n || !b || !a) return alert("กรอกข้อมูลให้ครบ");

  const u = "user" + (employees.length + 1);

  employees.push({
    id: Date.now(),
    username: u,
    password: "1234",
    name: n,
    bank: b,
    acc: a,
    photo: ""
  });

  await saveData("employees");
  updateAdminUI();

  document.getElementById("empName").value = "";
  document.getElementById("empBank").value = "";
  document.getElementById("empAcc").value = "";

  alert("เพิ่มพนักงานสำเร็จ User คือ: " + u);
}

async function deleteEmployee(id) {
  if (!confirm("ลบพนักงาน?")) return;

  employees = employees.filter(e => Number(e.id) !== Number(id));
  await saveData("employees");

  updateAdminUI();
  renderAdminDashboard();
}

async function addWorkLog() {
  const eid = document.getElementById("selectEmp").value;
  const d = document.getElementById("workDate").value;
  const s = document.getElementById("startTime").value;
  const e = document.getElementById("endTime").value;
  const r = Number(document.getElementById("entryRate").value);
  const f = Number(document.getElementById("entryFund").value || 0);

  if (!eid || !d || !s || !e || !r) return alert("ข้อมูลไม่ครบ");

  let diff = (new Date(`2024-01-01 ${e}`) - new Date(`2024-01-01 ${s}`)) / 3600000;
  const hrs = diff < 0 ? diff + 24 : diff;
  const total = hrs * r - f;

  workLogs.push({
    id: Date.now(),
    empId: Number(eid),
    date: d,
    start: s,
    end: e,
    rate: r,
    fund: f,
    hours: hrs.toFixed(2),
    total: total.toFixed(2),
    status: "pending"
  });

  await saveData("workLogs");
  renderAdminDashboard();

  alert("บันทึกงานสำเร็จ");
}

async function togglePay(id) {
  const log = workLogs.find(l => Number(l.id) === Number(id));
  if (!log) return;

  log.status = log.status === "paid" ? "pending" : "paid";

  await saveData("workLogs");
  renderAdminDashboard();
}

async function deleteWorkLog(id) {
  if (!confirm("ต้องการลบรายการประวัติงานนี้ใช่ไหม?")) return;

  workLogs = workLogs.filter(l => Number(l.id) !== Number(id));

  await saveData("workLogs");
  renderAdminDashboard();

  if (currentUser) renderUserDashboard();

  alert("ลบรายการเรียบร้อย");
}

function openEditWork(id) {
  const log = workLogs.find(l => Number(l.id) === Number(id));
  if (!log) return;

  document.getElementById("editLogId").value = log.id;
  document.getElementById("editDate").value = formatDateOnly(log.date);
  document.getElementById("editStart").value = log.start;
  document.getElementById("editEnd").value = log.end;
  document.getElementById("editRate").value = log.rate;
  document.getElementById("editFund").value = log.fund;

  workModal.show();
}

async function saveEditWork() {
  const logId = Number(document.getElementById("editLogId").value);
  const log = workLogs.find(l => Number(l.id) === logId);
  if (!log) return;

  log.date = document.getElementById("editDate").value;
  log.start = document.getElementById("editStart").value;
  log.end = document.getElementById("editEnd").value;
  log.rate = Number(document.getElementById("editRate").value);
  log.fund = Number(document.getElementById("editFund").value || 0);

  let diff = (new Date(`2024-01-01 ${log.end}`) - new Date(`2024-01-01 ${log.start}`)) / 3600000;
  log.hours = (diff < 0 ? diff + 24 : diff).toFixed(2);
  log.total = (Number(log.hours) * log.rate - log.fund).toFixed(2);

  await saveData("workLogs");
  renderAdminDashboard();
  workModal.hide();
}

function renderUserDashboard() {
  document.getElementById("uDisplayName").innerText = currentUser.name;
  document.getElementById("uInputBank").value = currentUser.bank || "";
  document.getElementById("uInputAcc").value = currentUser.acc || "";
  document.getElementById("uProfileImg").src =
    currentUser.photo
      ? normalizePhotoUrl(currentUser.photo)
      : "https://img5.pic.in.th/file/secure-sv1/user-placeholder.png";

  const myLogs = workLogs
    .filter(l => Number(l.empId) === Number(currentUser.id))
    .sort((a, b) => new Date(formatDateOnly(b.date)) - new Date(formatDateOnly(a.date)));

  let totalAll = 0;
  let totalFund = 0;
  let totalPaid = 0;
  let totalPending = 0;

  myLogs.forEach(log => {
    const total = Number(log.total || 0);
    const fund = Number(log.fund || 0);

    totalAll += total;
    totalFund += fund;

    if (log.status === "paid") totalPaid += total;
    else totalPending += total;
  });

  document.getElementById("uTotalFundAll").innerText = totalFund.toLocaleString() + " ฿";
  document.getElementById("uTotalAll").innerText = totalAll.toLocaleString() + " ฿";
  document.getElementById("uTotalPaid").innerText = totalPaid.toLocaleString() + " ฿";
  document.getElementById("uTotalPending").innerText = totalPending.toLocaleString() + " ฿";

  const allLogs = myLogs;
  const pendingLogs = myLogs.filter(log => log.status !== "paid");
  const paidLogs = myLogs.filter(log => log.status === "paid");

  const makeRows = (logs) => {
    if (!logs.length) {
      return `<tr><td colspan="5" class="text-muted">ยังไม่มีรายการ</td></tr>`;
    }

    return logs.map(log => `
      <tr>
        <td><small>${formatDateOnly(log.date)}</small></td>
        <td>${Number(log.hours || 0)} ชม.</td>
        <td>${Number(log.rate || 0).toLocaleString()} ฿/ชม.</td>
        <td>
          <span class="status-badge ${log.status === "paid" ? "status-badge-paid" : "status-badge-pending"}">
            ${log.status === "paid" ? "จ่ายแล้ว" : "รออนุมัติ"}
          </span>
        </td>
        <td class="fw-bold">${Number(log.total || 0).toLocaleString()} ฿</td>
      </tr>
    `).join("");
  };

  const makeTable = (logs) => `
    <div class="table-responsive">
      <table class="table table-sm text-center align-middle user-work-table">
        <thead class="table-light">
          <tr>
            <th>วันที่</th>
            <th>ชั่วโมง</th>
            <th>เรท/ชม.</th>
            <th>สถานะ</th>
            <th>เงิน</th>
          </tr>
        </thead>
        <tbody>${makeRows(logs)}</tbody>
      </table>
    </div>
  `;

  document.getElementById("monthlyAccordion").innerHTML = `
    <div class="card p-3 table-card">
      <h5 class="fw-bold mb-3">
        <i class="bi bi-list-ul"></i> รายการงานของฉัน
      </h5>

      <ul class="nav nav-tabs mb-3" id="userWorkTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#userAllLogs" type="button">
            รายการทั้งหมด
          </button>
        </li>

        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab" data-bs-target="#userPendingLogs" type="button">
            รายการที่รออนุมัติ
          </button>
        </li>

        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab" data-bs-target="#userPaidLogs" type="button">
            รายการที่จ่ายแล้ว
          </button>
        </li>
      </ul>

      <div class="tab-content">
        <div class="tab-pane fade show active" id="userAllLogs">
          ${makeTable(allLogs)}
        </div>

        <div class="tab-pane fade" id="userPendingLogs">
          ${makeTable(pendingLogs)}
        </div>

        <div class="tab-pane fade" id="userPaidLogs">
          ${makeTable(paidLogs)}
        </div>
      </div>
    </div>
  `;
}
