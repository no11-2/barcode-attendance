// ===== 生徒40人 =====
// バーコードの値は 001～040 にしています。
// 実際のバーコードには、この番号を登録してください。
const students = Array.from({length: 40}, (_, i) => ({
  id: String(i + 1).padStart(3, "0"),
  name: `生徒${i + 1}`
}));

const STORAGE_KEY = "barcodeAttendance_" + getDateKey();
let attendance = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

let scanner = null;
let running = false;

const reader = document.getElementById("reader");
const scanMessage = document.getElementById("scanMessage");
const resultBox = document.getElementById("resultBox");

document.getElementById("startBtn").addEventListener("click", startScanner);
document.getElementById("stopBtn").addEventListener("click", stopScanner);
document.getElementById("csvBtn").addEventListener("click", saveCSV);
document.getElementById("resetBtn").addEventListener("click", resetToday);

function getDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTime() {
  const d = new Date();
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function startScanner() {
  if (running) return;

  scanner = new Html5Qrcode("reader");

  scanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 280, height: 160 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    },
    onScanSuccess,
    () => {}
  ).then(() => {
    running = true;
    scanMessage.textContent = "バーコードをカメラに映してください。";
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
  }).catch(err => {
    scanMessage.textContent = "カメラを起動できませんでした。HTTPSまたはlocalhostで開いてください。";
    console.error(err);
  });
}

function stopScanner() {
  if (!scanner || !running) return;

  scanner.stop().then(() => {
    scanner.clear();
    running = false;
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    scanMessage.textContent = "カメラを停止しました。";
  }).catch(console.error);
}

function onScanSuccess(decodedText) {
  const id = decodedText.trim().padStart(3, "0");
  const student = students.find(s => s.id === id);

  if (!student) {
    resultBox.innerHTML = `<strong>⚠️ 未登録のバーコード</strong><br>読み取り値：${escapeHTML(decodedText)}`;
    scanMessage.textContent = "登録されていない番号です。";
    return;
  }

  if (attendance[id]) {
    resultBox.innerHTML =
      `<strong>⚠️ 登録済み</strong><br>` +
      `${student.id}　${escapeHTML(student.name)}<br>` +
      `登録時刻：${attendance[id].time}`;
    scanMessage.textContent = "この生徒はすでに出席登録されています。";
    return;
  }

  const time = getTime();
  const now = new Date();
  const late = now.getHours() >= 8 && now.getMinutes() >= 30;

  attendance[id] = {
    time,
    status: late ? "遅刻" : "出席"
  };

  saveData();
  renderTable();

  resultBox.innerHTML =
    `<strong>✅ 出席登録完了</strong><br>` +
    `${student.id}　${escapeHTML(student.name)}<br>` +
    `${time}　<span class="${late ? "late" : "present"}">${late ? "遅刻" : "出席"}</span>`;

  scanMessage.textContent = "次の生徒のバーコードを読み取れます。";
}

function renderTable() {
  const body = document.getElementById("attendanceBody");
  body.innerHTML = "";

  students.forEach(student => {
    const record = attendance[student.id];
    const tr = document.createElement("tr");

    const status = record ? record.status : "欠席";
    const cls = status === "出席" ? "present" :
                status === "遅刻" ? "late" : "absent";

    tr.innerHTML = `
      <td>${student.id}</td>
      <td>${escapeHTML(student.name)}</td>
      <td>${record ? record.time : "--"}</td>
      <td class="${cls}">${status}</td>
    `;

    body.appendChild(tr);
  });

  updateStats();
}

function updateStats() {
  let present = 0;
  let late = 0;

  Object.values(attendance).forEach(r => {
    if (r.status === "出席") present++;
    if (r.status === "遅刻") late++;
  });

  document.getElementById("presentCount").textContent = present;
  document.getElementById("lateCount").textContent = late;
  document.getElementById("absentCount").textContent = students.length - present - late;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attendance));
}

function saveCSV() {
  const rows = [
    ["番号", "名前", "時刻", "状態"]
  ];

  students.forEach(s => {
    const r = attendance[s.id];
    rows.push([
      s.id,
      s.name,
      r ? r.time : "",
      r ? r.status : "欠席"
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `出席記録_${getDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function resetToday() {
  if (!confirm("今日の出席記録をすべて削除します。よろしいですか？")) return;

  attendance = {};
  saveData();
  renderTable();

  resultBox.textContent = "今日の出席記録をリセットしました。";
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderTable();
