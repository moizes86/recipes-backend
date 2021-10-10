const express = require("express");
const router = express.Router();
const { emailer } = require("../emailer");
const { usersAPI } = require("../DAL/db");
const { validateData,verifyWithJwt } = require("../utils");
const jwt = require("jsonwebtoken");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

/* POST user signup */
router.post("/signup", validateData, async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const [result] = await usersAPI.signup(email, username, password);
    const randomCode = Math.floor(Math.random() * 100000);
    await usersAPI.insertCode(req.body.email, randomCode);
    await emailer(req.body.email, randomCode).catch(console.error);
    // req.body.code = randomCode;
    return res
      .status(200)
      .json({ payload: { userId: result.insertId, email }, message: "Signup Successful" });
  } catch (e) {
    return res.status(401).json({ message: e.message });
  }
});

/* Login */
router.post("/login", validateData, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usersAPI.login(email, password);
    const accessToken = jwt.sign({ email, password }, "verificationKey");

    return res.status(200).json({ message: "Login successful", payload: user, accessToken });
  } catch (e) {
    return res.status(401).json({ message: e.message });
  }
});

router.post("/verify", validateData, async (req, res) => {
  try {
    await usersAPI.verify(req.body);

    return res.status(200).json({ message: "Verification successful" });
  } catch (err) {
    return res.status(400).json({ message: err.message ?? "Error validating account. Try again later." });
  }
});

router.get("/login/:token", verifyWithJwt, async (req, res) => {
  const [user] = await usersAPI.getUser(req.data.email);
  return res.status(200).json({ payload: user });
});

/* Update user's details */
router.put("/update-details", validateData, async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const [result] = await usersAPI.updateDetails(email, username, password);
    res.status(200).json({ message: "Details updated", payload: { username, password } });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});



module.exports = router;
