/* =====================================================================
   BLOOM — TO-DO APP SCRIPT
   Table of contents:
   1. State & Constants
   2. DOM References
   3. Utility Helpers
   4. LocalStorage Persistence
   5. Toast Notifications
   6. Loading Screen
   7. Theme (Light/Dark) Handling
   8. Greeting, Clock, Date, Quotes
   9. Streak Counter
   10. Task CRUD (Create, Read, Update, Delete)
   11. Rendering (List, Search Highlighting, Empty State)
   12. Filtering, Searching, Sorting
   13. Statistics Dashboard (Ring + Bar + Numbers)
   14. Confetti Celebration
   15. Confirm Modal
   16. Import / Export JSON
   17. Ripple Button Effect
   18. Event Listeners & Keyboard Shortcuts
   19. App Initialization
   ===================================================================== */


/* =====================================================================
   1. STATE & CONSTANTS
   ===================================================================== */
const STORAGE_KEYS = {
  TASKS: "bloom_tasks",
  THEME: "bloom_theme",
  FILTER: "bloom_filter",
  STREAK: "bloom_streak",
  LAST_ACTIVE_DATE: "bloom_last_active_date",
};

const MOTIVATIONAL_QUOTES = [
  "Small steps every day lead to big changes.",
  "Done is better than perfect.",
  "You don't have to be great to start, but you have to start to be great.",
  "One task at a time, one win at a time.",
  "Progress, not perfection.",
  "Today's little effort is tomorrow's big result.",
  "Focus on being productive instead of busy.",
  "Your future is created by what you do today.",
  "The secret of getting ahead is getting started.",
  "Every accomplishment starts with the decision to try.",
  "Make today count, one checkmark at a time.",
  "Discipline is choosing what you want most over what you want now.",
];

// In-memory application state
let appState = {
  tasks: [], // { id, text, completed, priority, category, dueDate, createdAt, completedAt }
  filter: "all", // all | pending | completed
  searchQuery: "",
  sortBy: "created", // created | alpha | priority
};

let editingTaskId = null; // tracks which task is currently in inline-edit mode


/* =====================================================================
   2. DOM REFERENCES
   ===================================================================== */
const dom = {
  loadingScreen: document.getElementById("loadingScreen"),
  toastContainer: document.getElementById("toastContainer"),
  confettiCanvas: document.getElementById("confettiCanvas"),

  greetingText: document.getElementById("greetingText"),
  dayDate: document.getElementById("dayDate"),
  liveClock: document.getElementById("liveClock"),
  quoteText: document.getElementById("quoteText"),

  streakCount: document.getElementById("streakCount"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),

  ringProgress: document.getElementById("ringProgress"),
  progressPercent: document.getElementById("progressPercent"),
  statTotal: document.getElementById("statTotal"),
  statPending: document.getElementById("statPending"),
  statCompleted: document.getElementById("statCompleted"),
  progressBarFill: document.getElementById("progressBarFill"),

  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  clearCompletedBtn: document.getElementById("clearCompletedBtn"),

  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  prioritySelect: document.getElementById("prioritySelect"),
  categorySelect: document.getElementById("categorySelect"),
  dueDateInput: document.getElementById("dueDateInput"),

  searchInput: document.getElementById("searchInput"),
  filterTabs: document.querySelectorAll(".filter-tab"),
  sortSelect: document.getElementById("sortSelect"),

  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),
  emptyStateMessage: document.getElementById("emptyStateMessage"),

  confirmModal: document.getElementById("confirmModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn"),
};

// Ring circumference: 2 * PI * r (r = 64)
const RING_CIRCUMFERENCE = 2 * Math.PI * 64;

// Holds the action to run if the confirm modal is accepted
let pendingConfirmAction = null;


/* =====================================================================
   3. UTILITY HELPERS
   ===================================================================== */

/** Generates a reasonably unique ID for a task. */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Escapes HTML special characters to prevent injection when rendering text. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** Normalizes text for duplicate/comparison checks (trim + lowercase + collapse spaces). */
function normalizeText(str) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Formats a Date object as "Weekday, Month Day, Year". */
function formatFriendlyDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats a Date object as HH:MM:SS AM/PM. */
function formatClockTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Returns YYYY-MM-DD for "today" in local time, used for streak comparisons. */
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}


/* =====================================================================
   4. LOCALSTORAGE PERSISTENCE
   ===================================================================== */
function saveTasksToStorage() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(appState.tasks));
}

function loadTasksFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse saved tasks:", err);
    return [];
  }
}

function saveFilterToStorage(filter) {
  localStorage.setItem(STORAGE_KEYS.FILTER, filter);
}

function loadFilterFromStorage() {
  return localStorage.getItem(STORAGE_KEYS.FILTER) || "all";
}


/* =====================================================================
   5. TOAST NOTIFICATIONS
   ===================================================================== */
const TOAST_ICONS = {
  success: "fa-circle-check",
  error: "fa-circle-exclamation",
  warning: "fa-triangle-exclamation",
  info: "fa-circle-info",
};

/**
 * Shows a modern toast notification.
 * @param {string} message - Text to display.
 * @param {"success"|"error"|"warning"|"info"} type - Toast style.
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
  toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><span>${escapeHtml(message)}</span>`;

  dom.toastContainer.appendChild(toast);

  // Auto-dismiss after a delay
  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3200);
}


/* =====================================================================
   6. LOADING SCREEN
   ===================================================================== */
function hideLoadingScreen() {
  setTimeout(() => {
    dom.loadingScreen.classList.add("hidden");
  }, 900);
}


/* =====================================================================
   7. THEME (LIGHT/DARK) HANDLING
   ===================================================================== */
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  dom.themeIcon.classList.toggle("fa-moon", !isDark);
  dom.themeIcon.classList.toggle("fa-sun", isDark);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-theme");
  applyTheme(isDark ? "light" : "dark");
  showToast(`${isDark ? "Light" : "Dark"} mode enabled`, "info");
}


/* =====================================================================
   8. GREETING, CLOCK, DATE, QUOTES
   ===================================================================== */
function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = "Good evening";
  let icon = "🌙";

  if (hour < 12) {
    greeting = "Good morning";
    icon = "☀️";
  } else if (hour < 18) {
    greeting = "Good afternoon";
    icon = "🌤️";
  }

  dom.greetingText.textContent = `${greeting}! ${icon}`;
}

function updateDateAndClock() {
  const now = new Date();
  dom.dayDate.textContent = formatFriendlyDate(now);
  dom.liveClock.textContent = formatClockTime(now);
}

function startLiveClock() {
  updateDateAndClock();
  setInterval(updateDateAndClock, 1000);
}

function showRandomQuote() {
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  dom.quoteText.textContent = quote;
}


/* =====================================================================
   9. STREAK COUNTER
   ===================================================================== */
/**
 * A "productive day" is any day the user completes at least one task.
 * This function checks whether today already counted, and if the streak
 * should continue (yesterday was productive) or reset.
 */
function registerProductiveDay() {
  const todayKey = getTodayKey();
  const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_DATE);

  if (lastActive === todayKey) {
    return; // Already counted today
  }

  let streak = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK) || "0", 10);

  if (lastActive) {
    const lastDate = new Date(lastActive.split("-").map(Number).join("/"));
    const diffDays = Math.round((new Date(todayKey.split("-").map(Number).join("/")) - lastDate) / 86400000);
    streak = diffDays === 1 ? streak + 1 : 1;
  } else {
    streak = 1;
  }

  localStorage.setItem(STORAGE_KEYS.STREAK, String(streak));
  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, todayKey);
  renderStreak();
}

function renderStreak() {
  const streak = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK) || "0", 10);
  dom.streakCount.textContent = streak;
}


/* =====================================================================
   10. TASK CRUD
   ===================================================================== */
function addTask({ text, priority, category, dueDate }) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    showToast("Please write a task before adding it.", "warning");
    return false;
  }

  // Prevent duplicate *consecutive* tasks (compares to the most recently added task)
  const lastTask = appState.tasks[appState.tasks.length - 1];
  if (lastTask && normalizeText(lastTask.text) === normalizeText(trimmedText)) {
    showToast("That looks like the same task you just added.", "warning");
    return false;
  }

  const newTask = {
    id: generateTaskId(),
    text: trimmedText,
    completed: false,
    priority: priority || "medium",
    category: category || "general",
    dueDate: dueDate || null,
    createdAt: Date.now(),
    completedAt: null,
  };

  appState.tasks.push(newTask);
  saveTasksToStorage();
  renderTasks({ animateNewId: newTask.id });
  updateStatsDashboard();
  showToast("Task added! 🌱", "success");
  return true;
}

function deleteTask(taskId) {
  const taskEl = dom.taskList.querySelector(`[data-id="${taskId}"]`);

  const finishDelete = () => {
    appState.tasks = appState.tasks.filter((t) => t.id !== taskId);
    saveTasksToStorage();
    renderTasks();
    updateStatsDashboard();
  };

  if (taskEl) {
    taskEl.classList.add("removing");
    taskEl.addEventListener("animationend", finishDelete, { once: true });
  } else {
    finishDelete();
  }

  showToast("Task deleted.", "info");
}

function toggleTaskCompletion(taskId) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;

  saveTasksToStorage();
  renderTasks();
  updateStatsDashboard();

  if (task.completed) {
    registerProductiveDay();
    showToast("Nice work! Task completed. ✅", "success");
    checkForAllCompletedCelebration();
  } else {
    showToast("Task marked as pending again.", "info");
  }
}

function updateTaskText(taskId, newText) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return false;

  const trimmed = newText.trim();
  if (!trimmed) {
    showToast("Task can't be empty. Edit cancelled.", "error");
    return false;
  }

  task.text = trimmed;
  saveTasksToStorage();
  showToast("Task updated.", "success");
  return true;
}

/** Updates a single field (category or priority) on a task and re-renders. */
function updateTaskField(taskId, field, value) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task[field] = value;
  saveTasksToStorage();
  renderTasks();
  updateStatsDashboard();
  showToast(`Task ${field} updated.`, "success");
}

function clearCompletedTasks() {
  const hadCompleted = appState.tasks.some((t) => t.completed);
  if (!hadCompleted) {
    showToast("No completed tasks to clear.", "info");
    return;
  }

  appState.tasks = appState.tasks.filter((t) => !t.completed);
  saveTasksToStorage();
  renderTasks();
  updateStatsDashboard();
  showToast("Completed tasks cleared.", "success");
}


/* =====================================================================
   11. RENDERING
   ===================================================================== */
function getPriorityWeight(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 1;
}

function getVisibleTasks() {
  let tasks = [...appState.tasks];

  // Filter by status
  if (appState.filter === "pending") {
    tasks = tasks.filter((t) => !t.completed);
  } else if (appState.filter === "completed") {
    tasks = tasks.filter((t) => t.completed);
  }

  // Filter by search query
  if (appState.searchQuery) {
    const query = normalizeText(appState.searchQuery);
    tasks = tasks.filter((t) => normalizeText(t.text).includes(query));
  }

  // Sort
  if (appState.sortBy === "alpha") {
    tasks.sort((a, b) => a.text.localeCompare(b.text));
  } else if (appState.sortBy === "priority") {
    tasks.sort((a, b) => getPriorityWeight(a.priority) - getPriorityWeight(b.priority));
  } else {
    tasks.sort((a, b) => a.createdAt - b.createdAt);
  }

  return tasks;
}

/** Wraps matches of the search query in <mark> tags for highlighting. */
function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "ig");
  return escapedText.replace(regex, "<mark>$1</mark>");
}

// Human-friendly labels shown inside each task's editable category/priority dropdowns
const CATEGORY_OPTIONS = {
  general: "🌿 General",
  work: "💼 Work",
  personal: "🏡 Personal",
  health: "💪 Health",
  learning: "📚 Learning",
};

const PRIORITY_OPTIONS = {
  low: "🟢 Low",
  medium: "🟡 Medium",
  high: "🔴 High",
};

function formatDueDate(dueDateStr) {
  const due = new Date(dueDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = due < today;
  const label = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { label, isOverdue };
}

function buildTaskElement(task) {
  const li = document.createElement("li");
  li.className = `task-item${task.completed ? " completed" : ""}`;
  li.dataset.id = task.id;

  // Checkbox
  const checkbox = document.createElement("button");
  checkbox.className = `task-checkbox${task.completed ? " checked" : ""}`;
  checkbox.setAttribute("aria-label", task.completed ? "Mark as pending" : "Mark as completed");
  checkbox.innerHTML = task.completed ? '<i class="fa-solid fa-check"></i>' : "";
  checkbox.addEventListener("click", () => toggleTaskCompletion(task.id));

  // Body (text + meta chips)
  const body = document.createElement("div");
  body.className = "task-body";

  const textEl = document.createElement("p");
  textEl.className = "task-text";
  textEl.innerHTML = highlightMatch(task.text, appState.searchQuery);
  textEl.title = "Double-click to edit";
  textEl.addEventListener("dblclick", () => enterEditMode(task.id, textEl));
  body.appendChild(textEl);

  // Meta row: category, priority, due date
  const meta = document.createElement("div");
  meta.className = "task-meta";

  const categorySelect = document.createElement("select");
  categorySelect.className = "meta-chip meta-select";
  categorySelect.setAttribute("aria-label", "Change category");
  Object.entries(CATEGORY_OPTIONS).forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    opt.selected = value === task.category;
    categorySelect.appendChild(opt);
  });
  categorySelect.addEventListener("change", (e) => updateTaskField(task.id, "category", e.target.value));
  meta.appendChild(categorySelect);

  const prioritySelect = document.createElement("select");
  prioritySelect.className = `meta-chip meta-select priority-${task.priority}`;
  prioritySelect.setAttribute("aria-label", "Change priority");
  Object.entries(PRIORITY_OPTIONS).forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    opt.selected = value === task.priority;
    prioritySelect.appendChild(opt);
  });
  prioritySelect.addEventListener("change", (e) => updateTaskField(task.id, "priority", e.target.value));
  meta.appendChild(prioritySelect);

  if (task.dueDate) {
    const { label, isOverdue } = formatDueDate(task.dueDate);
    const dueChip = document.createElement("span");
    dueChip.className = `meta-chip due-chip${isOverdue && !task.completed ? " overdue" : ""}`;
    dueChip.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${label}`;
    meta.appendChild(dueChip);
  }

  body.appendChild(meta);

  // Actions (edit / delete)
  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "task-icon-btn edit-btn";
  editBtn.setAttribute("aria-label", "Edit task");
  editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
  editBtn.addEventListener("click", () => enterEditMode(task.id, textEl));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "task-icon-btn delete-btn";
  deleteBtn.setAttribute("aria-label", "Delete task");
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  deleteBtn.addEventListener("click", () => deleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(actions);

  return li;
}

/** Renders the full visible task list based on current filter/search/sort state. */
function renderTasks({ animateNewId } = {}) {
  const visibleTasks = getVisibleTasks();

  dom.taskList.innerHTML = "";

  visibleTasks.forEach((task) => {
    const el = buildTaskElement(task);
    if (task.id === animateNewId) {
      el.style.animation = "taskIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both";
    }
    dom.taskList.appendChild(el);
  });

  updateEmptyState(visibleTasks.length === 0);
}

function updateEmptyState(isEmpty) {
  dom.emptyState.classList.toggle("visible", isEmpty);

  if (!isEmpty) return;

  if (appState.searchQuery) {
    dom.emptyStateMessage.textContent = `No tasks match "${appState.searchQuery}".`;
  } else if (appState.filter === "completed") {
    dom.emptyStateMessage.textContent = "No completed tasks yet. Keep going!";
  } else if (appState.filter === "pending") {
    dom.emptyStateMessage.textContent = "No pending tasks. You're all caught up!";
  } else {
    dom.emptyStateMessage.textContent = "Add your first task above and start blooming 🌱";
  }
}


/* =====================================================================
   Inline Editing
   ===================================================================== */
function enterEditMode(taskId, textEl) {
  if (editingTaskId) return; // Only one task editable at a time
  editingTaskId = taskId;

  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;

  textEl.textContent = task.text; // Strip highlight markup while editing
  textEl.contentEditable = "true";
  textEl.focus();

  // Place cursor at the end of the text
  const range = document.createRange();
  range.selectNodeContents(textEl);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const finishEditing = (shouldSave) => {
    textEl.contentEditable = "false";
    textEl.removeEventListener("keydown", onKeyDown);
    textEl.removeEventListener("blur", onBlur);
    editingTaskId = null;

    if (shouldSave) {
      const saved = updateTaskText(taskId, textEl.textContent);
      if (!saved) {
        textEl.textContent = task.text; // revert to original if empty
      }
    } else {
      textEl.textContent = task.text; // revert on escape
    }
    renderTasks();
  };

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEditing(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishEditing(false);
    }
  }

  function onBlur() {
    finishEditing(true);
  }

  textEl.addEventListener("keydown", onKeyDown);
  textEl.addEventListener("blur", onBlur);
}


/* =====================================================================
   12. FILTERING, SEARCHING, SORTING (event wiring)
   ===================================================================== */
function setFilter(filter) {
  appState.filter = filter;
  saveFilterToStorage(filter);

  dom.filterTabs.forEach((tab) => {
    const isActive = tab.dataset.filter === filter;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  renderTasks();
}

function setSearchQuery(query) {
  appState.searchQuery = query;
  renderTasks();
}

function setSortBy(sortBy) {
  appState.sortBy = sortBy;
  renderTasks();
}


/* =====================================================================
   13. STATISTICS DASHBOARD
   ===================================================================== */
function updateStatsDashboard() {
  const total = appState.tasks.length;
  const completed = appState.tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  dom.statTotal.textContent = total;
  dom.statPending.textContent = pending;
  dom.statCompleted.textContent = completed;
  dom.progressPercent.textContent = `${percent}%`;

  // Animate progress ring
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  dom.ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  dom.ringProgress.style.strokeDashoffset = `${offset}`;

  // Animate progress bar
  dom.progressBarFill.style.width = `${percent}%`;
}


/* =====================================================================
   14. CONFETTI CELEBRATION
   ===================================================================== */
let confettiActive = false;

function checkForAllCompletedCelebration() {
  const total = appState.tasks.length;
  const completed = appState.tasks.filter((t) => t.completed).length;

  if (total > 0 && completed === total) {
    launchConfetti();
    showToast("🎉 All tasks completed! Amazing job!", "success");
  }
}

function launchConfetti() {
  if (confettiActive) return;
  confettiActive = true;

  const canvas = dom.confettiCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";

  const colors = ["#ffb3c6", "#a3d9c9", "#cdb4f0", "#ffe19c", "#a9d6f5"];
  const particles = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: 2 + Math.random() * 3,
    speedX: -2 + Math.random() * 4,
    rotation: Math.random() * 360,
    rotationSpeed: -6 + Math.random() * 12,
  }));

  let frame = 0;
  const maxFrames = 220;

  function animate() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (frame < maxFrames) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
      confettiActive = false;
    }
  }

  requestAnimationFrame(animate);
}


/* =====================================================================
   15. CONFIRM MODAL
   ===================================================================== */
function openConfirmModal({ title, message, onConfirm }) {
  dom.modalTitle.textContent = title;
  dom.modalMessage.textContent = message;
  pendingConfirmAction = onConfirm;
  dom.confirmModal.hidden = false;
}

function closeConfirmModal() {
  dom.confirmModal.hidden = true;
  pendingConfirmAction = null;
}


/* =====================================================================
   16. IMPORT / EXPORT JSON
   ===================================================================== */
function exportTasksAsJson() {
  if (appState.tasks.length === 0) {
    showToast("There are no tasks to export yet.", "warning");
    return;
  }

  const dataStr = JSON.stringify(appState.tasks, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `bloom-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("Tasks exported successfully.", "success");
}

function importTasksFromJson(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) throw new Error("Invalid format");

      // Basic validation + normalization of each imported task
      const validTasks = imported
        .filter((t) => t && typeof t.text === "string" && t.text.trim())
        .map((t) => ({
          id: t.id || generateTaskId(),
          text: t.text.trim(),
          completed: Boolean(t.completed),
          priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
          category: t.category || "general",
          dueDate: t.dueDate || null,
          createdAt: t.createdAt || Date.now(),
          completedAt: t.completedAt || null,
        }));

      if (validTasks.length === 0) {
        showToast("No valid tasks found in that file.", "error");
        return;
      }

      appState.tasks = [...appState.tasks, ...validTasks];
      saveTasksToStorage();
      renderTasks();
      updateStatsDashboard();
      showToast(`Imported ${validTasks.length} task(s) successfully.`, "success");
    } catch (err) {
      console.error("Import failed:", err);
      showToast("That file couldn't be read. Please choose a valid JSON export.", "error");
    }
  };

  reader.onerror = () => showToast("Failed to read the selected file.", "error");
  reader.readAsText(file);
}


/* =====================================================================
   17. RIPPLE BUTTON EFFECT
   ===================================================================== */
function attachRippleEffect(selector) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);

      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      btn.style.position = btn.style.position || "relative";
      btn.style.overflow = "hidden";
      btn.appendChild(ripple);

      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });
}


/* =====================================================================
   18. EVENT LISTENERS & KEYBOARD SHORTCUTS
   ===================================================================== */
function setupEventListeners() {
  // Add task form submit
  dom.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const added = addTask({
      text: dom.taskInput.value,
      priority: dom.prioritySelect.value,
      category: dom.categorySelect.value,
      dueDate: dom.dueDateInput.value,
    });

    if (added) {
      dom.taskInput.value = "";
      dom.dueDateInput.value = "";
      dom.taskInput.focus();
    }
  });

  // Theme toggle
  dom.themeToggle.addEventListener("click", toggleTheme);

  // Search (live)
  dom.searchInput.addEventListener("input", (e) => setSearchQuery(e.target.value));

  // Filter tabs
  dom.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => setFilter(tab.dataset.filter));
  });

  // Sort dropdown
  dom.sortSelect.addEventListener("change", (e) => setSortBy(e.target.value));

  // Export / Import
  dom.exportBtn.addEventListener("click", exportTasksAsJson);
  dom.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importTasksFromJson(file);
    e.target.value = ""; // allow re-importing the same file later
  });

  // Clear completed (with confirmation)
  dom.clearCompletedBtn.addEventListener("click", () => {
    openConfirmModal({
      title: "Clear completed tasks?",
      message: "This will permanently remove all completed tasks. This action can't be undone.",
      onConfirm: clearCompletedTasks,
    });
  });

  // Modal buttons
  dom.modalCancelBtn.addEventListener("click", closeConfirmModal);
  dom.modalConfirmBtn.addEventListener("click", () => {
    if (pendingConfirmAction) pendingConfirmAction();
    closeConfirmModal();
  });
  dom.confirmModal.addEventListener("click", (e) => {
    if (e.target === dom.confirmModal) closeConfirmModal();
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement.tagName;
    const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || document.activeElement.isContentEditable;

    if (e.key === "Escape" && !dom.confirmModal.hidden) {
      closeConfirmModal();
      return;
    }

    if (isTyping) return; // Don't hijack shortcuts while user is typing elsewhere

    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      dom.taskInput.focus();
    } else if (e.key === "/") {
      e.preventDefault();
      dom.searchInput.focus();
    } else if (e.key === "t" || e.key === "T") {
      toggleTheme();
    }
  });
}


/* =====================================================================
   19. APP INITIALIZATION
   ===================================================================== */
function initApp() {
  // Load persisted state
  appState.tasks = loadTasksFromStorage();
  appState.filter = loadFilterFromStorage();

  // Theme
  initTheme();

  // Header widgets
  updateGreeting();
  startLiveClock();
  showRandomQuote();
  renderStreak();

  // Restore filter tab UI to match saved filter
  dom.filterTabs.forEach((tab) => {
    const isActive = tab.dataset.filter === appState.filter;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  // Initial render
  renderTasks();
  updateStatsDashboard();

  // Wire up interactions
  setupEventListeners();
  attachRippleEffect(".add-btn, .ghost-btn, .filter-tab");

  // Hide loading splash once everything is ready
  hideLoadingScreen();
}

document.addEventListener("DOMContentLoaded", initApp);
