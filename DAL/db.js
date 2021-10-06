var mysql = require("mysql2");

const bcrypt = require("bcrypt");
const saltRounds = 10;

async function generateHash(password) {
  let hash = await new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) reject(err);
      resolve(hash);
    });
  });
  return hash;
}

const pool = mysql.createPool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASS,
  database: process.env.DB,
});
// now get a Promise wrapped instance of that pool
const promisePool = pool.promise();

const usersAPI = {
  async signup(email, username, password) {
    const hash = await generateHash(password);
    try {
      return await promisePool.execute("INSERT INTO Users (email, username, password ) VALUES (?,?,?);", [
        email,
        username,
        hash,
      ]);
    } catch (e) {
      if (e.errno === 1062) throw Error("User already exists. Try different email address.");
      return e;
    }
  },

  async login(email, password) {
    const [result] = await promisePool.execute("SELECT * FROM users WHERE email = ?;", [email]);

    if (!result.length) throw Error("Email or password incorrect");

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw Error("Incorrect password");
    if (!user.verified) throw Error("Unauthorized - please verify your account");
    user.password = password;
    return user;
  },

  async updateDetails(email, username, password) {
    const hash = await generateHash(password);
    try {
      return await promisePool.execute("UPDATE users SET username = ?, password= ? WHERE email = ?;", [
        username,
        hash,
        email,
      ]);
    } catch (e) {
      return [e];
    }
  },

  async insertCode(email, code) {
    try {
      const result = promisePool.execute("Update Users SET Code = ? WHERE (email = ?);", [code, email]);
      return { success: true, payload: "Updated" };
    } catch (err) {
      return { success: false, payload: "Something went wrong. Try again later" };
    }
  },

  async verify({ email, code }) {
    let [user] = await promisePool.execute("SELECT email, code FROM Users WHERE (email = ?)", [email]);
    user = user[0];
    if (user.code === +code) {
      const result = await promisePool.execute("UPDATE Users SET verified = 1, code = 0 WHERE (email = ?)", [
        email,
      ]);
      return;
    }
    throw Error("Verification failed - codes does not match");
  },
};

const recipesAPI = {
  async getRecipes() {
    try {
      const [recipes] = await promisePool.execute(
        `
        SELECT r.*,
        GROUP_CONCAT(i.url ORDER BY i.id) urls
        FROM recipes r LEFT JOIN images i
        ON i.recipe_id = r.id
        GROUP BY r.id
        ;`
      );
      if (recipes.length) {
        recipes.forEach((recipe) => {
          if (recipe.urls) recipe.urls = recipe.urls.split(",");
        });
      }

      return [recipes];
    } catch (e) {
      return e;
    }
  },

  async getRecipesBySearch(q) {
    try {
      return ([result] = await promisePool.execute(
        `SELECT * FROM recipes WHERE title LIKE N'%${q}%' \ 
        ORDER BY case when title LIKE N'${q}%' then 1 else 2 end;`
      ));
    } catch (e) {
      return e;
    }
  },

  async getRecipe(recipeId) {
    try {
      const [result] = await promisePool.execute("SELECT * FROM Recipes WHERE (Recipes.id = ?);", [recipeId]);
      return result[0];
    } catch (e) {
      return e;
    }
  },

  async getIngredientsForRecipe(recipeId) {
    try {
      return ([result] = await promisePool.execute(
        "SELECT * FROM ingredients WHERE (Ingredients.recipe_id = ?);",
        [recipeId]
      ));
    } catch (e) {
      throw Error("Error getting ingredients");
    }
  },

  async getInstructionsForRecipe(recipeId) {
    try {
      let [result] = await promisePool.execute("SELECT * FROM instructions \
        WHERE recipe_id = ? ;", [
        recipeId,
      ]);
      return result;
    } catch (e) {
      return e;
    }
  },

  async getDietsForRecipe(recipeId) {
    try {
      let [diets] = await promisePool.execute(
        "SELECT d.id, d.title \
        FROM diets d \
        JOIN recipes_diets rd \
        ON rd.diet_id = d.id \
        WHERE rd.recipe_id= ? ;",
        [recipeId]
      );
      return Array.from(diets).map((diet) => diet.title);
    } catch (e) {
      return e;
    }
  },

  async getCategoriesForRecipe(recipeId) {
    try {
      let [categories] = await promisePool.execute(
        "SELECT c.id, c.title \
        FROM categories c \
        JOIN recipes_categories rc \
        ON rc.category_id = c.id \
        WHERE rc.recipe_id= ? ;",
        [recipeId]
      );
      return Array.from(categories).map((category) => category.title);
    } catch (e) {
      return e;
    }
  },

  async getImagesForRecipe(recipeId) {
    try {
      const [result] = await promisePool.execute(
        "SELECT url \
        FROM images \
        WHERE recipe_id= ? ;",
        [recipeId]
      );
      return result.map((url) => url.url);
    } catch (err) {
      return [err];
    }
  },

  async getCategories() {
    try {
      const [result] = await promisePool.execute(`SELECT title FROM categories;`);
      return result.map((item) => item.title);
    } catch (e) {
      return [e];
    }
  },

  async getMeasuringUnits() {
    try {
      const [result] = await promisePool.execute(`SELECT title FROM measuring_units;`);
      return result.map((item) => item.title);
    } catch (e) {
      return [e];
    }
  },

  async getDiets() {
    try {
      const [result] = await promisePool.execute(`SELECT * FROM diets;`);
      return result.map((item) => item.title);
    } catch (e) {
      return [e];
    }
  },

  async getOptions() {
    const [diets] = await promisePool.execute("SELECT title FROM diets");
    const [categories] = await promisePool.execute("SELECT title FROM categories");
    const [measuringUnits] = await promisePool.execute("SELECT title FROM measuring_units");
    const result = {
      diets: diets.map((el) => el.title),
      categories: categories.map((el) => el.title),
      measuringUnits: measuringUnits.map((el) => el.title),
    };

    return result;
  },

  async createRecipe(email, title, description, source = "", source_url = "", servings = "", cook = "") {
    try {
      return ([result] = await promisePool.execute(
        "INSERT INTO recipes \
        (email, title, description, source, source_url, servings, cook)\
        VALUES (?, ?, ?, ?, ?, ?, ?);",
        [email, title, description, source, source_url, servings, cook]
      ));
    } catch (e) {
      debugger;

      return e;
    }
  },

  async addIngredients(recipeId, ingredients) {
    try {
      const result = [];
      ingredients.forEach((ingredient) => {
        const { id, text, amount, unit } = ingredient;
        const queryResult = promisePool.execute(
          "INSERT IGNORE INTO ingredients\
         ( id, recipe_id, text , amount, unit)\
          VALUES (?,?,?,?,?);",
          [id ?? null, recipeId, text, amount, unit]
        );
        result.push(queryResult);
      });
      return result;
    } catch (e) {
      return [e];
    }
  },

  async addInstructions(recipeId, instructions) {
    try {
      const result = [];
      instructions.forEach(async (instruction) => {
        const queryResult = await promisePool.execute(
          "INSERT IGNORE INTO instructions\
          (id, recipe_id, text)\
          VALUES (?,?,?)",
          [instruction.id ?? null, recipeId, instruction.text]
        );
        result.push(queryResult);
      });
      return result;
    } catch (e) {
      return [e];
    }
  },

  async addDiets(recipeId, diets) {
    try {
      const result = [];
      const [dietsFromDB] = await promisePool.execute("SELECT * FROM Diets");
      diets.forEach(async (diet) => {
        const dietId = dietsFromDB.findIndex((item) => item.title === diet) + 1;
        const queryResult = await promisePool.execute(
          "INSERT INTO recipes_diets\
          (recipe_id, diet_id)\
          VALUES (?,?)",
          [recipeId, dietId]
        );
        result.push(queryResult);
      });
      return result;
    } catch (e) {
      return [e];
    }
  },

  async addCategories(recipeId, categories) {
    try {
      const result = [];
      const [categoriesFromDB] = await promisePool.execute("SELECT * FROM Categories");
      categories.forEach(async (category) => {
        const categoryId = categoriesFromDB.findIndex((item) => item.title === category) + 1;
        const queryResult = await promisePool.execute(
          "INSERT INTO recipes_categories\
          (recipe_id, category_id)\
          VALUES (?,?)",
          [recipeId, categoryId]
        );
        result.push(queryResult);
      });
      return result;
    } catch (e) {
      return [e];
    }
  },

  async addImages(recipeId, imageURLs) {
    try {
      const result = [];
      console.log('INSIDE ADD IMAGES')
      imageURLs.forEach(async (url) => {
        const queryResult = await promisePool.execute(
          "INSERT INTO images\
          (recipe_id, url)\
          VALUES (?,?)",
          [recipeId, url]
          );
          console.log('AFTER ADD IMAGES')
        result.push(queryResult);
      });
      return result;
    } catch (err) {
      return [err];
    }
  },

  async deleteRecipe(recipeId) {
    try {
      const imageUrls = await promisePool.execute("SELECT url FROM images WHERE recipe_id = ?;", [recipeId]);
      await promisePool.execute("DELETE FROM Recipes WHERE Recipes.id = ?;", [recipeId]);
      return imageUrls;
    } catch (err) {
      return [err];
    }
  },

  async deleteDiets(recipeId) {
    try {
      return await promisePool.execute("DELETE FROM recipes_diets WHERE recipe_id = ?;", [recipeId]);
    } catch (e) {
      return e;
    }
  },

  async deleteCategories(recipeId) {
    try {
      return await promisePool.execute("DELETE FROM recipes_categories WHERE recipe_id = ?;", [recipeId]);
    } catch (e) {
      return e;
    }
  },

  async deleteIngredients(ingredientId) {
    try {
      return await promisePool.execute("DELETE FROM ingredients WHERE id = ? ;", [ingredientId]);
    } catch (e) {
      return e;
    }
  },

  async deleteInstructions(instructionId) {
    try {
      promisePool.execute("DELETE FROM instructions WHERE id = ?;", [instructionId]);
    } catch (e) {
      return e;
    }
  },

  async deleteImages(recipeId, imageUrls) {
    try {
      const [existingImages] = await promisePool.execute("SELECT * FROM Images WHERE recipe_id = ?;", [
        recipeId,
      ]);

      if (!imageUrls) {
        await promisePool.execute("DELETE FROM Images WHERE recipe_id = ?;", [recipeId]);
        return Array.from(existingImages).map((image) => image.url);
      } else {
        const imageUrlsToBeDeletedFromStorage = [];
        Array.from(existingImages).forEach(async (image) => {
          if (!imageUrls.includes(image.url)) {
            await promisePool.execute("DELETE FROM Images WHERE id = ?;", [image.id]);
            imageUrlsToBeDeletedFromStorage.push(image.url);
          }
        });
        return imageUrlsToBeDeletedFromStorage;
      }
    } catch (err) {
      return err;
    }
  },

  async updateRecipe(recipeId, title, description, source, url, servings, cook) {
    try {
      return ([result] = await promisePool.execute(
        "UPDATE recipes SET \
        title = ?, description =? , source=?, source_url=?, servings=?, cook=?  \
        WHERE id = ?",
        [title, description, source ?? null, url ?? null, servings ?? null, cook ?? null, recipeId]
      ));
    } catch (e) {
      return e;
    }
  },

  async editIngredient(id, amount) {
    try {
      return ([result] = await promisePool.execute("UPDATE ingredients SET amount= ? \
        WHERE id = ?", [
        amount,
        id,
      ]));
    } catch (e) {
      return e;
    }
  },

  async getMyRecipes(email) {
    try {
      return ([result] = await promisePool.execute(
        `
        SELECT r.*, 
        i.url urls
        FROM recipes r LEFT JOIN images i
        ON i.recipe_id = r.id
        Where r.email = ?
        GROUP BY r.id;`,
        [email]
      ));
    } catch (e) {
      debugger;
      return e;
    }
  },
};

module.exports = {
  recipesAPI,
  usersAPI,
};
