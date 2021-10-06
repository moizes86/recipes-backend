const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const logger = require("morgan");
const cors = require("cors");
const app = express();
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const recipesRouter = require("./routes/recipes");

app.use(logger("dev"));
app.use(express.json());
app.use(
  cors({
    methods: ["GET", "POST", "PUT", "DELETE"],
    origin: ["http://localhost:3000", "http://localhost:5000", "https://recipes-mm.netlify.app"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  session({
    key: "auth",
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    // cookie: {
    //   expires: 1000 * 60,
    //   sameSite: "none",
    //   httpOnly: true,
    //   secure: true,
    // },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "")));
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/recipes", recipesRouter);

app.set("trust proxy", 1);
module.exports = app;
