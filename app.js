(() => {
  "use strict";
  const DB_NAME = "BanglaSchoolDB";
  const DB_VERSION = 1;
  const STORE = "students";
  let db;

  const $ = (id) => document.getElementById(id);
  const form = $("studentForm");
  const status = $("connectionStatus");

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          const studentStore = database.createObjectStore(STORE, { keyPath: "id" });
          studentStore.createIndex("name", "name", { unique: false });
          studentStore.createIndex("className", "className", { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error("ডেটাবেজ খোলা যায়নি"));
      request.onblocked = () => reject(new Error("ডেটাবেজ অন্য ট্যাবে খোলা আছে। অন্য ট্যাব বন্ধ করে আবার চেষ্টা করুন।"));
    });
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "student-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function store(mode = "readonly") {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function getAll() {
    return new Promise((resolve, reject) => {
      const req = store().getAll();
      req.onsuccess = () => resolve(req.result.sort((a,b) =>
        a.className.localeCompare(b.className, "bn") ||
        a.name.localeCompare(b.name, "bn")
      ));
      req.onerror = () => reject(req.error);
    });
  }

  function saveStudent(student) {
    return new Promise((resolve, reject) => {
      const req = store("readwrite").put(student);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function deleteStudent(id) {
    return new Promise((resolve, reject) => {
      const req = store("readwrite").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function addText(parent, tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value ?? "";
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  async function render() {
    const all = await getAll();
    const query = $("search").value.trim().toLocaleLowerCase("bn");
    const filtered = all.filter(s =>
      [s.name, s.className, s.roll, s.guardianPhone]
        .some(v => String(v || "").toLocaleLowerCase("bn").includes(query))
    );
    $("studentCount").textContent = `মোট ${all.length.toLocaleString("bn")} জন`;
    const list = $("studentList");
    list.replaceChildren();

    if (!filtered.length) {
      addText(list, "div", all.length ? "কোনো মিল পাওয়া যায়নি।" : "এখনও কোনো শিক্ষার্থী যোগ করা হয়নি।", "empty");
      return;
    }

    filtered.forEach(student => {
      const card = document.createElement("article");
      card.className = "student";
      addText(card, "strong", student.name);
      addText(card, "p", `শ্রেণি: ${student.className}  |  রোল: ${student.roll || "—"}`);
      addText(card, "p", `অভিভাবকের ফোন: ${student.guardianPhone || "—"}`);
      const actions = document.createElement("div");
      actions.className = "actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "সম্পাদনা";
      edit.addEventListener("click", () => fillForm(student));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "মুছে ফেলুন";
      remove.addEventListener("click", async () => {
        if (confirm(`“${student.name}” এর তথ্য মুছে ফেলবেন?`)) {
          await deleteStudent(student.id);
          await render();
          resetForm();
        }
      });
      actions.append(edit, remove);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function fillForm(s) {
    $("studentId").value = s.id;
    $("name").value = s.name;
    $("className").value = s.className;
    $("roll").value = s.roll || "";
    $("guardianPhone").value = s.guardianPhone || "";
    $("formTitle").textContent = "শিক্ষার্থীর তথ্য সম্পাদনা";
    $("saveButton").textContent = "পরিবর্তন সংরক্ষণ";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset();
    $("studentId").value = "";
    $("formTitle").textContent = "নতুন শিক্ষার্থী ভর্তি";
    $("saveButton").textContent = "শিক্ষার্থী সংরক্ষণ";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = $("saveButton");
    saveButton.disabled = true;
    try {
      if (!db) throw new Error("ডেটাবেজ এখনও প্রস্তুত নয়। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      const id = $("studentId").value || makeId();
      const previous = await new Promise((resolve, reject) => {
        const req = store().get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("আগের তথ্য পড়া যায়নি"));
      });

      const student = {
        id,
        name: $("name").value.trim(),
        className: $("className").value,
        roll: $("roll").value.trim(),
        guardianPhone: $("guardianPhone").value.trim(),
        createdAt: previous?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!student.name || !student.className) {
        alert("শিক্ষার্থীর নাম ও শ্রেণি লিখুন।");
        return;
      }
      await saveStudent(student);
      await render();
      resetForm();
      status.textContent = "সফল • শিক্ষার্থীর তথ্য এই ব্রাউজারে সংরক্ষিত হয়েছে";
      alert("শিক্ষার্থীর তথ্য সংরক্ষণ হয়েছে।");
    } catch (error) {
      console.error("Student save failed:", error);
      status.textContent = "সংরক্ষণ করা যায়নি: " + (error?.message || "অজানা সমস্যা");
      alert("শিক্ষার্থীর তথ্য সংরক্ষণ করা যায়নি।
" + (error?.message || "আবার চেষ্টা করুন।"));
    } finally {
      saveButton.disabled = false;
    }
  });

  $("resetButton").addEventListener("click", resetForm);
  $("search").addEventListener("input", render);

  $("exportButton").addEventListener("click", async () => {
    const data = {
      app: "Bangla Offline School Management",
      version: 1,
      exportedAt: new Date().toISOString(),
      students: await getAll()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `school-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $("backupFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.students)) throw new Error("ভুল ব্যাকআপ ফাইল");
      if (!confirm(`${data.students.length}টি রেকর্ড রিস্টোর করবেন?`)) return;
      for (const s of data.students) {
        if (s && typeof s.id === "string" && typeof s.name === "string" && typeof s.className === "string") {
          await saveStudent({
            id: s.id,
            name: s.name,
            className: s.className,
            roll: String(s.roll || ""),
            guardianPhone: String(s.guardianPhone || ""),
            createdAt: s.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      await render();
      alert("ব্যাকআপ রিস্টোর সম্পন্ন হয়েছে।");
    } catch (error) {
      alert("ব্যাকআপ ফাইল পড়া যায়নি। সঠিক JSON ব্যাকআপ নির্বাচন করুন।");
    } finally {
      event.target.value = "";
    }
  });

  async function init() {
    try {
      if (!("indexedDB" in window)) throw new Error("IndexedDB নেই");
      db = await openDatabase();
      await render();

      if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
        try {
          await navigator.serviceWorker.register("./sw.js");
        } catch (e) {
          console.warn("Service worker registration failed", e);
        }
      }
      status.textContent = navigator.onLine
        ? "প্রস্তুত • ডেটা এই ডিভাইসে সংরক্ষিত হয়"
        : "অফলাইন মোড • ডেটা এই ডিভাইসে সংরক্ষিত হয়";
      window.addEventListener("online", () => status.textContent = "অনলাইন • লোকাল ডেটাবেজ সক্রিয়");
      window.addEventListener("offline", () => status.textContent = "অফলাইন মোড • লোকাল ডেটাবেজ সক্রিয়");
    } catch (error) {
      status.textContent = "ডেটাবেজ চালু করা যায়নি। Chrome/Edge-এর বর্তমান সংস্করণে HTTPS বা localhost থেকে খুলুন।";
      console.error(error);
    }
  }
  init();
})();
