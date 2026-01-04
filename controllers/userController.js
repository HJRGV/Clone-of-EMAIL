const User = require('../models/User');

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) return res.json([]);

    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
      ],
    }).select('email username _id').limit(5);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
