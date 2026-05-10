// ========================================
// NotebookLM RAG — Client-Side Application
// ========================================

// --- DOM Elements ---
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const uploadProgress = document.getElementById("uploadProgress");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const documentsList = document.getElementById("documentsList");
const emptyState = document.getElementById("emptyState");
const chatContainer = document.getElementById("chatContainer");
const welcomeScreen = document.getElementById("welcomeScreen");
const messages = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const activeDocumentHeader = document.getElementById("activeDocumentHeader");
const toastContainer = document.getElementById("toastContainer");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

// --- State ---
let documents = [];
let activeDocument = null;
let isProcessing = false;

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  loadDocuments();
  setupEventListeners();
});

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  // File upload — click
  dropzone.addEventListener("click", (e) => {
    if (e.target !== fileInput && !e.target.closest('.upload-btn')) {
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", handleFileSelect);

  // Drag and drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  // Chat input
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener("click", sendMessage);

  // Auto-resize textarea
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + "px";
  });

  // Mobile sidebar
  mobileMenuBtn.addEventListener("click", toggleSidebar);
  sidebarToggle.addEventListener("click", toggleSidebar);
}

// ========================================
// FILE UPLOAD
// ========================================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) uploadFile(file);
  fileInput.value = ""; // Reset so same file can be re-uploaded
}

async function uploadFile(file) {
  // Validate file type
  const validTypes = ["application/pdf", "text/plain"];
  if (!validTypes.includes(file.type)) {
    showToast("Only PDF and TXT files are supported.", "error");
    return;
  }

  // Validate file size (20MB)
  if (file.size > 20 * 1024 * 1024) {
    showToast("File size must be under 20MB.", "error");
    return;
  }

  if (isProcessing) {
    showToast("Please wait for the current upload to finish.", "info");
    return;
  }

  isProcessing = true;
  showUploadProgress("Uploading document...");

  const formData = new FormData();
  formData.append("document", file);

  try {
    // Animate progress
    animateProgress(0, 30, 500);
    progressText.textContent = "Uploading...";

    animateProgress(30, 60, 2000);
    progressText.textContent = "Chunking & embedding document...";

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type");
    let data = {};
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server error (${response.status}): ${text.substring(0, 50)}`);
    }

    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }

    animateProgress(60, 100, 500);
    progressText.textContent = "Indexing complete!";

    setTimeout(() => {
      hideUploadProgress();
      showToast(`"${data.document.name}" uploaded — ${data.document.chunkCount} chunks indexed!`, "success");
      loadDocuments();
    }, 800);
  } catch (error) {
    hideUploadProgress();
    showToast(error.message || "Failed to upload document.", "error");
    console.error("Upload error:", error);
  } finally {
    isProcessing = false;
  }
}

function showUploadProgress(text) {
  uploadProgress.classList.add("active");
  progressFill.style.width = "0%";
  progressText.textContent = text;
}

function hideUploadProgress() {
  uploadProgress.classList.remove("active");
  progressFill.style.width = "0%";
}

function animateProgress(from, to, duration) {
  progressFill.style.transition = `width ${duration}ms ease`;
  progressFill.style.width = `${to}%`;
}

// ========================================
// DOCUMENT MANAGEMENT
// ========================================
async function loadDocuments() {
  try {
    const response = await fetch("/api/documents");
    documents = await response.json();
    renderDocuments();
  } catch (error) {
    console.error("Failed to load documents:", error);
  }
}

function renderDocuments() {
  if (documents.length === 0) {
    documentsList.innerHTML = "";
    documentsList.appendChild(createEmptyState());
    return;
  }

  documentsList.innerHTML = "";
  documents.forEach((doc) => {
    const item = document.createElement("div");
    item.className = `doc-item${activeDocument?.id === doc.id ? " active" : ""}`;
    item.id = `doc-${doc.id}`;

    const ext = doc.name.split(".").pop().toLowerCase();
    const icon = ext === "pdf" ? "📕" : "📄";

    item.innerHTML = `
      <div class="doc-icon">${icon}</div>
      <div class="doc-info">
        <div class="doc-name" title="${doc.name}">${doc.name}</div>
        <div class="doc-meta">${doc.chunkCount} chunks</div>
      </div>
      <button class="doc-delete" title="Delete document" aria-label="Delete ${doc.name}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M8 6V4C8 3.4 8.4 3 9 3H15C15.6 3 16 3.4 16 4V6M19 6V20C19 20.6 18.6 21 18 21H6C5.4 21 5 20.6 5 20V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    // Click to select document
    item.addEventListener("click", (e) => {
      if (e.target.closest(".doc-delete")) return;
      selectDocument(doc);
    });

    // Delete button
    item.querySelector(".doc-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteDocument(doc);
    });

    documentsList.appendChild(item);
  });
}

function selectDocument(doc) {
  activeDocument = doc;
  renderDocuments();

  // Update header
  activeDocumentHeader.innerHTML = `
    <span class="active-doc-label">Chatting with </span>
    <span class="active-doc-name">${doc.name}</span>
  `;

  // Enable input
  chatInput.disabled = false;
  sendBtn.disabled = false;
  chatInput.placeholder = `Ask a question about "${doc.name}"...`;

  // Show chat, hide welcome
  welcomeScreen.classList.add("hidden");

  // Clear previous messages
  messages.innerHTML = "";

  // Close mobile sidebar
  closeSidebar();

  chatInput.focus();
}

async function deleteDocument(doc) {
  if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

  try {
    const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    // If deleted doc was active, reset chat
    if (activeDocument?.id === doc.id) {
      activeDocument = null;
      chatInput.disabled = true;
      sendBtn.disabled = true;
      chatInput.placeholder = "Ask a question about your document...";
      activeDocumentHeader.innerHTML = `<span class="active-doc-label">Select a document to start chatting</span>`;
      welcomeScreen.classList.remove("hidden");
      messages.innerHTML = "";
    }

    showToast(`"${doc.name}" deleted.`, "success");
    loadDocuments();
  } catch (error) {
    showToast(error.message || "Failed to delete document.", "error");
  }
}

function createEmptyState() {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `
    <p>No documents uploaded yet</p>
    <p class="empty-hint">Upload a document to start chatting</p>
  `;
  return div;
}

// ========================================
// CHAT
// ========================================
async function sendMessage() {
  const query = chatInput.value.trim();
  if (!query || !activeDocument || isProcessing) return;

  isProcessing = true;

  // Add user message
  addMessage(query, "user");

  // Clear input
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;

  // Show typing indicator
  const typingEl = addTypingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        collectionName: activeDocument.collectionName,
      }),
    });

    const data = await response.json();

    // Remove typing indicator
    typingEl.remove();

    if (!response.ok) throw new Error(data.error);

    // Add assistant message with sources
    addMessage(data.answer, "assistant", data.sources);
  } catch (error) {
    typingEl.remove();
    addMessage("Sorry, something went wrong. Please try again.", "assistant");
    showToast(error.message || "Failed to get response.", "error");
    console.error("Chat error:", error);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

function addMessage(content, role, sources = []) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}`;

  const avatar = role === "user" ? "👤" : "🤖";

  // Simple markdown rendering for assistant messages
  const rendered = role === "assistant" ? renderMarkdown(content) : escapeHtml(content);

  let sourcesHtml = "";
  if (sources.length > 0) {
    sourcesHtml = `
      <div class="message-sources">
        ${sources.map((s) => `<span class="source-badge">📌 ${escapeHtml(s)}</span>`).join("")}
      </div>
    `;
  }

  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-bubble">${rendered}</div>
      ${sourcesHtml}
    </div>
  `;

  messages.appendChild(messageEl);
  scrollToBottom();
}

function addTypingIndicator() {
  const el = document.createElement("div");
  el.className = "message assistant";
  el.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  messages.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ========================================
// MARKDOWN RENDERING (lightweight)
// ========================================
function renderMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Line breaks — convert double newlines to paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// MOBILE SIDEBAR
// ========================================
function toggleSidebar() {
  sidebar.classList.toggle("open");

  // Manage overlay
  let overlay = document.querySelector(".sidebar-overlay");
  if (sidebar.classList.contains("open")) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay active";
      overlay.addEventListener("click", closeSidebar);
      document.body.appendChild(overlay);
    } else {
      overlay.classList.add("active");
    }
  } else {
    if (overlay) overlay.classList.remove("active");
  }
}

function closeSidebar() {
  sidebar.classList.remove("open");
  const overlay = document.querySelector(".sidebar-overlay");
  if (overlay) overlay.classList.remove("active");
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
