const { LoginValidationError } = require("./Errors");

const validationsAPI = {
  required(name, value) {
    if (!value) throw Error(`${name} is required`);
  },

  user(cookie){
    console.log(cookie)
  },
  
  email(email) {
    this.required("Email", email);
    const reg = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!reg.test(email)) throw new LoginValidationError("Invalid Email");
  },

  username(username) {
    this.required("Username", username);
    const reg = /^[a-zA-Z]{5,}\S*$/;
    if (!reg.test(username)) {
      if (username.length < 5) throw Error("Username too short! Minimum 5 chars");
      if (username.length > 5) throw Error("Username too long! Maximum 20 chars");
      throw Error("Invalid username");
    }
  },

  password(password) {
    this.required("Password", password);
    const reg = /^(?=.*[0-9])(?=.*[a-zA-Z]).{6,}$/;
    if (password.length < 6) throw new LoginValidationError("Password length must be at least six chars");
    if (!reg.test(password)) throw new LoginValidationError("Invalid password. Must contain numbers and letters");
  },

  confirmPassword(confirmPassword, password) {
    this.required("Confirm password", confirmPassword);
    const reg = /^(?=.*[0-9])(?=.*[a-zA-Z]).{6,}$/;
    if (password.length < 6) throw Error("Password length must be at least six chars");
    if (!reg.test(password)) throw Error("Invalid password. Must contain numbers and letters");
    if (confirmPassword !== password) throw Error("Passwords do not match");
  },

  title(title) {
    this.required("Title", title);
    if (title.length < 4) throw Error("Title must be at least four chars");
    if (title.length > 45) throw Error("Title is too long! Maximum 45 chars");
  },

  sourceUrl(sourceUrl) {
    const reg =
      /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
    if (!reg.test(sourceUrl)) throw Error("Invalid source url");
  },

  servings(n) {
    if (n < 0 || n > 10) throw Error("Servings must be between 1-10");
  },

  cook(n) {
    if (n < 0) throw Error("Invalid cook time");
  },

  image(image) {
    const reg = /(http(s?):\/\/)(.)*\.(?:jpe?g|gif|png)/;
    if (!reg.test(image)) throw Error("Invalid image url");
  },

  ingredients(ingredients) {
    if (!ingredients.length) throw Error("Ingredients are required");
    ingredients.forEach((ingredient) => {
      if (!ingredient.text || ingredient.amount <=0)  throw Error("Invalid ingredient");
    });
  },

  instructions(instructions) {
    if (!instructions.length) throw Error("Instructions are required");
    instructions.forEach((instruction) => {
      if (!instruction) throw Error("Invalid instruction");
    });
  },
};

module.exports = {
  validationsAPI,
};
