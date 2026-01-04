const Message = require("../models/Message");
const User = require("../models/User");
const { emitNewMessage } = require("../socket");

/* =========================================================
   HELPERS
========================================================= */

const findReceiverByEmailOrUsername = async (value) => {
  return await User.findOne({
    $or: [{ email: value }, { username: value }],
  });
};

/* =========================================================
   SEND MESSAGE
========================================================= */

exports.sendMessage = async (req, res) => {
  try {
    const { receiver, subject, body } = req.body;

    if (!receiver || !subject || !body) {
      return res.status(400).json({ message: "All fields required" });
    }

    const receiverUser = await findReceiverByEmailOrUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverUser._id,
      subject,
      body,
      isDraft: false,
    });

    // Create thread root
    message.threadId = message._id;
    await message.save();

    emitNewMessage(receiverUser._id, message);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   INBOX (PAGINATION) — FIXED
========================================================= */
exports.getInbox = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Message.countDocuments({
      receiver: req.user._id,
      isDraft: false,
      isTrashed: false,
    });

    const messages = await Message.find({
      receiver: req.user._id,
      isDraft: false,
      isTrashed: false,
    })
      .populate("sender", "email username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      messages,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Inbox error:", error);
    res.status(500).json({ message: "Failed to load inbox" });
  }
};

/* =========================================================
   GET MESSAGE BY ID
========================================================= */

exports.getMessageById = async (req, res) => {
  const message = await Message.findById(req.params.id)
    .populate("sender receiver", "username email");

  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }

  res.json(message);
};

/* =========================================================
   MARK AS READ
========================================================= */

exports.markAsRead = async (req, res) => {
  const message = await Message.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true }
  );

  res.json(message);
};

/* =========================================================
   REPLY MESSAGE
========================================================= */

exports.replyMessage = async (req, res) => {
  try {
    const { body } = req.body;

    const original = await Message.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ message: "Original message not found" });
    }

    const reply = await Message.create({
      sender: req.user._id,
      receiver: original.sender,
      subject: `Re: ${original.subject}`,
      body,
      threadId: original.threadId || original._id,
      isDraft: false,
    });

    emitNewMessage(original.sender, reply);

    res.status(201).json(reply);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   FORWARD MESSAGE
========================================================= */

exports.forwardMessage = async (req, res) => {
  try {
    const { receiver } = req.body;

    const receiverUser = await findReceiverByEmailOrUsername(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const original = await Message.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ message: "Original message not found" });
    }

    const forwarded = await Message.create({
      sender: req.user._id,
      receiver: receiverUser._id,
      subject: `Fwd: ${original.subject}`,
      body: original.body,
      threadId: original.threadId,
      isDraft: false,
    });

    emitNewMessage(receiverUser._id, forwarded);

    res.status(201).json(forwarded);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   SAVE DRAFT
========================================================= */

exports.saveDraft = async (req, res) => {
  try {
    const { receiver, subject, body } = req.body;

    let receiverId = null;

    if (receiver) {
      const user = await findReceiverByEmailOrUsername(receiver);
      if (!user) {
        return res.status(404).json({ message: "Receiver not found" });
      }
      receiverId = user._id;
    }

    const draft = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      subject: subject || "",
      body: body || "",
      isDraft: true,
    });

    res.status(201).json(draft);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   GET DRAFTS
========================================================= */

exports.getDrafts = async (req, res) => {
  const drafts = await Message.find({
    sender: req.user._id,
    isDraft: true,
  }).sort({ updatedAt: -1 });

  res.json(drafts);
};

/* =========================
   UPDATE DRAFT
========================= */
exports.updateDraft = async (req, res) => {
  try {
    const { receiver, subject, body } = req.body;

    let receiverId = null;
    if (receiver) {
      const user = await User.findOne({
        $or: [{ email: receiver }, { username: receiver }],
      });
      if (!user) {
        return res.status(404).json({ message: "Receiver not found" });
      }
      receiverId = user._id;
    }

    const draft = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        sender: req.user._id,
        isDraft: true,
      },
      {
        receiver: receiverId,
        subject,
        body,
      },
      { new: true }
    );

    if (!draft) {
      return res.status(404).json({ message: "Draft not found" });
    }

    res.json({ message: "Draft updated", data: draft });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================================
   SEND DRAFT
========================================================= */

exports.sendDraft = async (req, res) => {
  const draft = await Message.findById(req.params.id);
  if (!draft) {
    return res.status(404).json({ message: "Draft not found" });
  }

  draft.isDraft = false;
  draft.threadId = draft._id;
  await draft.save();

  emitNewMessage(draft.receiver, draft);

  res.json(draft);
};

/* =========================================================
   MOVE TO TRASH
========================================================= */

exports.moveToTrash = async (req, res) => {
  const message = await Message.findByIdAndUpdate(
    req.params.id,
    { isTrashed: true },
    { new: true }
  );

  res.json(message);
};

/* =========================
   RESTORE FROM TRASH
========================= */
exports.restoreFromTrash = async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        receiver: req.user._id,
        isTrashed: true,
      },
      { isTrashed: false },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json({ message: "Message restored", data: message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================
   VIEW TRASH
========================= */
exports.viewTrash = async (req, res) => {
  try {
    const trashMessages = await Message.find({
      receiver: req.user._id,
      isTrashed: true,
    })
      .populate("sender", "username email")
      .sort({ createdAt: -1 });

    res.json(trashMessages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================================
   PERMANENT DELETE
========================================================= */

exports.deleteMessage = async (req, res) => {
  await Message.findByIdAndDelete(req.params.id);
  res.json({ message: "Message permanently deleted" });
};

/* =========================================================
   SEARCH & FILTER
========================================================= */

exports.searchMessages = async (req, res) => {
  const { q } = req.query;

  const messages = await Message.find({
    receiver: req.user._id,
    isDraft: false,
    isTrashed: false,
    $or: [
      { subject: { $regex: q, $options: "i" } },
      { body: { $regex: q, $options: "i" } },
    ],
  }).sort({ createdAt: -1 });

  res.json(messages);
};

/* =========================================================
   THREAD VIEW
========================================================= */

exports.getThread = async (req, res) => {
  const messages = await Message.find({
    threadId: req.params.threadId,
  })
    .populate("sender receiver", "username email")
    .sort({ createdAt: 1 });

  res.json(messages);
};
