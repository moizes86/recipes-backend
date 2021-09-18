var express = require("express");
var router = express.Router();
const { recipesAPI } = require("../DAL/db");
const path = require("path");
const fs = require("fs");
const { validationsAPI } = require("../DAL/validations");
const { validateData, jsonifyData } = require("../utils");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 },
  fileFilter: imageFilter,
});

const createRecipeInDB = async (req, res, next) => {
  try {
    let {
      title,
      description,
      source,
      source_url,
      servings,
      cook,
      dietsSelected,
      categoriesSelected,
      ingredients,
      instructions,
    } = req.body;

    const user_id = req.cookies.user.id;
    // Add to recipes table
    const [resultCreateRecipe] = await recipesAPI.createRecipe(
      user_id,
      title,
      description,
      source,
      source_url,
      servings,
      cook
    );

    const newRecipeId = resultCreateRecipe.insertId;
    await recipesAPI.addIngredients(newRecipeId, ingredients);
    await recipesAPI.addInstructions(newRecipeId, instructions);
    await recipesAPI.addDiets(newRecipeId, dietsSelected);
    await recipesAPI.addCategories(newRecipeId, categoriesSelected);
    if (req.files) {
      await recipesAPI.addImages(
        newRecipeId,
        req.files.map((file) => file.path)
      );
    }

    req.insertId = newRecipeId;
  } catch (err) {
    return res.status(400).send(err.message);
  }

  next();
};

router.get("/", async (req, res) => {
  try {
    const [result] = await recipesAPI.getRecipes();
    return res.status(200).json({ payload: result });
  } catch (e) {
    return res.status(500).json({ err: e.message });
  }
});

router.get("/search?:q", async (req, res) => {
  try {
    const { q } = req.query;
    const [recipes] = await recipesAPI.getRecipesBySearch(q);

    return res.status(200).json({ payload: recipes });
  } catch (e) {
    return res.status(400).json({ err: e.message });
  }
});

router.get("/recipe?:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.query;
    const recipe = await recipesAPI.getRecipe(recipeId);
    const [ingredients] = await recipesAPI.getIngredientsForRecipe(recipeId);
    const instructions = await recipesAPI.getInstructionsForRecipe(recipeId);
    const dietsSelected = await recipesAPI.getDietsForRecipe(recipeId);
    const categoriesSelected = await recipesAPI.getCategoriesForRecipe(recipeId);
    const images = await recipesAPI.getImagesForRecipe(recipeId);

    res
      .status(200)
      .json({ payload: { ...recipe, ingredients, instructions, dietsSelected, categoriesSelected, images } });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

router.delete("/recipe?:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.query;

    //returns image urls
    const imageUrls = await recipesAPI.deleteRecipe(+recipeId);
    imageUrls[0]
      .map((el) => el.url)
      .forEach((url) =>
        fs.unlink(url, (err, result) => {
          if (err) return err;
        })
      );

    res.status(200).send("Recipe deleted");
  } catch (err) {
    res.status(400).send("Problem deleting recipe");
  }
});

router.get("/options", async (req, res) => {
  try {
    const result = await recipesAPI.getOptions();
    return res.status(200).json({ payload: result });
  } catch (e) {
    return res.status(401).json({ message: "Problem getting recipes options. Try again later" });
  }
});

router.post(
  "/add-recipe",
  upload.array("images"),
  jsonifyData,
  validateData,
  createRecipeInDB,
  (req, res) => {
    res.status(200).json({ message: "Recipe uploaded", payload: {recipe_id: req.insertId} });
  }
);

router.put("/edit-recipe", upload.array("images"), jsonifyData, validateData, async (req, res) => {
  let {
    id: recipe_id,
    title,
    description,
    source,
    source_url,
    servings,
    cook,
    dietsSelected,
    categoriesSelected,
    ingredients,
    instructions,
    ingredientsDeleted = [],
    instructionsDeleted = [],
    images,
  } = req.body;

  try {
    // Add to recipes table
    await recipesAPI.updateRecipe(recipe_id, title, description, source, source_url, servings, cook);

    // Ingredients
    await ingredientsDeleted.forEach((ingredientId) => recipesAPI.deleteIngredients(ingredientId));
    await recipesAPI.addIngredients(recipe_id, ingredients);

    // Instructions
    await instructionsDeleted.forEach((instructionId) => recipesAPI.deleteInstructions(instructionId));
    await recipesAPI.addInstructions(recipe_id, instructions);

    // Diets
    await recipesAPI.deleteDiets(recipe_id);
    await recipesAPI.addDiets(recipe_id, dietsSelected);

    // Categories
    await recipesAPI.deleteCategories(recipe_id);
    await recipesAPI.addCategories(recipe_id, categoriesSelected);

    // Images
    const imageUrlsToBeDeletedFromStorage = await recipesAPI.deleteImages(recipe_id, images);
    imageUrlsToBeDeletedFromStorage.forEach((url) => fs.unlink(url, (err, result) => {}));
    if (req.files.length) {
      await recipesAPI.addImages(
        recipe_id,
        req.files.map((file) => file.path)
      );
    }

    res.status(200).json({ message: "Recipe Updated", payload: { id: recipe_id, title } });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

router.get("/my-recipes?:id", async (req, res) => {
  const { userId } = req.query;
  try {
    const [result] = await recipesAPI.getMyRecipes(userId);
    res.status(200).json({ payload: result });
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

module.exports = router;
