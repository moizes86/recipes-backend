const express = require("express");
const router = express.Router();

const { usersAPI } = require("../DAL/db");
const { validationsAPI } = require("../DAL/validations");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

/* POST user signup */
router.post("/signup", async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body;
    validationsAPI.email(email);
    validationsAPI.username(username);
    validationsAPI.password(password);
    validationsAPI.confirmPassword(confirmPassword, password);

    const [result] = await usersAPI.signup(email, username, password);
    return res.status(200).json({ payload: result, message: "Signup Successful" });
  } catch (e) {
    return res.status(401).json({ message: e.message });
  }
});

/* Login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    validationsAPI.email(email);
    validationsAPI.password(password);

    const [user] = await usersAPI.login(email, password);
    if (!user.length) {
      throw Error("Email or password incorrect");
    } else {
      res.cookie("user", user);
      return res.status(200).json({ message: "Login successful", payload: user[0] });
    }
  } catch (e) {
    return res.status(401).json({ message: e.message });
  }
});

router.get("/login", async (req, res) => {
  if (req.cookies.user) return res.status(200).json({ payload: req.cookies.user[0] });
  return res.status(400).json({ payload: false });
});

router.post("/logout", async (req, res) => {
  res.clearCookie("user");
  res.status(200).send("Logged out");
});

/* Update user's details */
router.put("/update-details", async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body;
    validationsAPI.username(username);
    validationsAPI.password(password);
    validationsAPI.confirmPassword(confirmPassword, password);
    const [result] = await usersAPI.updateDetails(email, username, password);
    res
      .status(200)
      .json({ message: "Details updated", payload: { username, password } });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

module.exports = router;
