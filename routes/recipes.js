var express = require("express");

var router = express.Router();
const { recipesAPI } = require("../DAL/db");
const path = require("path");
const fs = require("fs");
const { validateData, jsonifyData, verifyWithJwt } = require("../utils");
const { uploadFile, getFileStream, deleteFile } = require("../s3");
const { upload } = require("../multer");

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

router.get("/my-recipes?:email", async (req, res) => {
  const { email } = req.query;
  try {
    const [result] = await recipesAPI.getMyRecipes(email);
    res.status(200).json({ payload: result });
  } catch (e) {
    res.status(500).json({ err: e.message });
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
  verifyWithJwt,
  jsonifyData,
  validateData,
  async (req, res) => {
    try {
      let {
        email,
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

      // const user_id = req.cookies.user.id;
      // Add to recipes table
      const [resultCreateRecipe] = await recipesAPI.createRecipe(
        email,
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
        // save to aws s3
        try {
          const awsFilesData = [];
          for (const file of req.files) {
            const result = await uploadFile(file);
            awsFilesData.push(result);
          }

          const awsImagesURLs = awsFilesData.map((file) => file.key);
          const devModeImagesURLs = req.files.map((file) => "http://localhost:3100/" + file.path);

          await recipesAPI.addImages(
            newRecipeId,
            process.env.NODE_ENV === "development" ? devModeImagesURLs : awsImagesURLs
          );
        } catch (err) {
          return res.status(400).json("Error saving images");
        }
      }
      res
        .status(200)
        .json({ message: "Recipe uploaded", payload: { id: newRecipeId, title: req.body.title } });
    } catch (err) {
      return res.status(400).send(err.message);
    }
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
    const imageUrlsToBeDeleted = await recipesAPI.deleteImages(recipe_id, images);
    // imageUrlsToBeDeleted.forEach((url) => fs.unlink("public/images/" + url, (err, result) => {}));
    for (const url of imageUrlsToBeDeleted) {
      fs.unlink("public/images/" + url, (err, result) => {});
      deleteFile(url);
    }

    if (req.files.length) {
      const awsFilesData = [];
      for (const file of req.files) {
        const result = await uploadFile(file);
        awsFilesData.push(result);
      }
      const awsImagesURLs = awsFilesData.map((file) => file.key);
      const devModeImagesURLs = req.files.map((file) => "http://localhost:3100/" + file.path);
      await recipesAPI.addImages(
        recipe_id,
        process.env.NODE_ENV === "development" ? devModeImagesURLs : awsImagesURLs
      );
    }

    res.status(200).json({ message: "Recipe Updated", payload: { id: recipe_id, title } });
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
      .forEach((url) => {
        fs.unlink("public/images/" + url, (err, result) => {
          if (err) return err;
        });
        deleteFile(url);
      });

    res.status(200).send("Recipe deleted");
  } catch (err) {
    res.status(400).send("Problem deleting recipe");
  }
});

router.get("/images/:key", (req, res) => {
  const key = req.params.key;
  const readStream = getFileStream(key);
  readStream.pipe(res);
});

module.exports = router;
