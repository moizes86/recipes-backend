const jwt = require("jsonwebtoken");

const { validationsAPI } = require("./DAL/validations");

const validateData = (req, res, next) => {
  for (const key in req.body) {
    try {
      if (validationsAPI[key]) {
        if (key === "confirmPassword") {
          validationsAPI[key](req.body[key], req.body["password"]);
        } else {
          validationsAPI[key](req.body[key]);
        }
      }
    } catch (err) {
      debugger;
      return res.status(400).json(err.message);
    }
  }
  next();
};

const jsonifyData = (req, res, next) => {
  for (const key in req.body) {
    try {
      req.body[key] = JSON.parse(req.body[key]);
    } catch (e) {
      console.log(key + "is a string");
    }
  }
  next();
};

const verifyWithJwt = (req, res, next) => {
  const token = req.params.token;
  if (token) {
    jwt.verify(token, "verificationKey", (err, data) => {
      if (err) {
        return res.status(403).json({ message: "Invalid token" });
      }
      req.data = data;
      next();
    });
  } else {
    return res.status(401).json({ message: "Not authenticated" });
  }
};


module.exports = {
  validateData,
  jsonifyData,
  verifyWithJwt,
};
