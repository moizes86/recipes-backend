const express = require("express");
const router = express.Router();

const { usersAPI } = require("../DAL/db");
const { validationsAPI } = require("../DAL/validations");
const { LoginValidationError } = require("../DAL/Errors");

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
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ err: e.message });
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
      res.status(200).json(user[0]);
    }
  } catch (e) {
    res.status(200).json({ status: 401, err: e.message, data: undefined });
  }
});

router.get("/login", async (req, res) => {
  if (req.cookies.user) {
    res.status(200).send(req.cookies.user);
  } else res.status(400).send("Not signed in");
});

router.post("/logout", async (req, res) => {
  res.clearCookie("user");
  res.status(200).send("Logged out");
});

/* Update user's details */
router.put("/update-details", async (req, res) => {
  try {
    const [id, username, password, confirmPassword] = req.body;
    validationsAPI.username(username);
    validationsAPI.password(password);
    validationsAPI.confirmPassword(confirmPassword, password);
    const [result] = await usersAPI.updateDetails(id, username, password);
    res.status(200).json({ id, username, password, confirmPassword });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

module.exports = router;
