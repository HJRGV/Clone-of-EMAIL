const express = require("express");
const router = express.Router();

const {
  sendMessage,
  getInbox,
  getMessageById,
  markAsRead,
  replyMessage,
  forwardMessage,
  saveDraft,
  getDrafts,
  updateDraft,
  sendDraft,
  moveToTrash,
  restoreFromTrash,
  viewTrash,
  deleteMessage,
  searchMessages,
  getThread,
} = require("../controllers/messageController");

const authMiddleware = require("../middleware/authMiddleware");

/* =========================
   SEND / RECEIVE
========================= */
router.post("/send", authMiddleware, sendMessage);
router.get("/inbox", authMiddleware, getInbox);

/* =========================
   SEARCH (BEFORE :id)
========================= */
router.get("/search/query", authMiddleware, searchMessages);

/* =========================
   TRASH
========================= */
router.get("/trash/all", authMiddleware, viewTrash);

/* =========================
   DRAFTS
========================= */
router.post("/draft", authMiddleware, saveDraft);
router.get("/drafts", authMiddleware, getDrafts);
router.put("/draft/:id", authMiddleware, updateDraft);
router.post("/draft/:id/send", authMiddleware, sendDraft);

/* =========================
   THREADS
========================= */
router.get("/thread/:threadId", authMiddleware, getThread);

/* =========================
   MESSAGE ACTIONS
========================= */
router.put("/:id/read", authMiddleware, markAsRead);
router.post("/:id/reply", authMiddleware, replyMessage);
router.post("/:id/forward", authMiddleware, forwardMessage);
router.put("/:id/trash", authMiddleware, moveToTrash);
router.put("/:id/restore", authMiddleware, restoreFromTrash);
router.delete("/:id", authMiddleware, deleteMessage);

/* =========================
   SINGLE MESSAGE (LAST)
========================= */
router.get("/:id", authMiddleware, getMessageById);

module.exports = router;
