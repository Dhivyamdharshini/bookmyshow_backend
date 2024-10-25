const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid"); // Import UUID
const dotenv = require("dotenv").config();
const URL = process.env.DB;

const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/movie/get-movies", async (req, res) => {
  try {
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let collection = await db.collection(COLLECTION_NAME);

    let movies = await collection.find({}).toArray();
    (await client).close();

    res.json(movies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let collection = await db.collection(COLLECTION_NAME);

    let movie = await collection.findOne({ _id: id }); // Use custom ID directly
    (await client).close();

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/movie/book-movie", async (req, res) => {
  let bookingRequest = req.body;

  if (
    !bookingRequest.movieId ||
    !bookingRequest.showId ||
    !bookingRequest.seats ||
    !bookingRequest.name ||
    !bookingRequest.email ||
    !bookingRequest.phoneNumber
  ) {
    return res.status(401).json({ message: "Some fields are missing" });
  }

  let requestedSeat = parseInt(bookingRequest.seats);

  if (isNaN(requestedSeat) || requestedSeat <= 0) {
    return res.status(401).json({ message: "Invalid seat count" });
  }

  try {
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let dbcollection = await db.collection(COLLECTION_NAME);

    let movie = await dbcollection.findOne({
      _id: bookingRequest.movieId,
    });

    if (!movie) {
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    const show = Object.values(movie.shows)
      .flat()
      .find((s) => s.id === bookingRequest.showId);

    if (!show) {
      return res.status(404).json({ message: "Show not Found" });
    }

    if (parseInt(show.seats) < requestedSeat) {
      return res.status(404).json({ message: "Not enough seats available" });
    }

    const updateSeats = parseInt(show.seats) - requestedSeat;
    
    const date = Object.keys(movie.shows).find((d) =>
      movie.shows[d].some((s) => s.id === bookingRequest.showId)
    );

    const showIndex = movie.shows[date].findIndex(
      (s) => s.id === bookingRequest.showId
    );

    const userBooking = {
      name: bookingRequest.name,
      email: bookingRequest.email,
      phoneNumber: bookingRequest.phoneNumber,
      seats: bookingRequest.seats,
    };

    const updatedResult = await dbcollection.updateOne(
      { _id: bookingRequest.movieId },
      {
        $set: {
          [`shows.${date}.${showIndex}.seats`]: updateSeats,
        },
        $push: {
          [`shows.${date}.${showIndex}.bookings`]: userBooking,
        },
      }
    );

    if (updatedResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update" });
    }

    return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Add a new movie with a custom ID
app.post("/movie/add-movie", async (req, res) => {
  const newMovie = req.body;
  newMovie._id = uuidv4(); // Assign custom UUID as ID

  try {
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    
    let collection = await db.collection(COLLECTION_NAME);
    
    await collection.insertOne(newMovie);
    
    (await client).close();

    res.status(201).json({ message: "Movie added successfully", movie: newMovie });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});