const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();

const URL = process.env.DB;
const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

let client;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Connect to the database
async function connectToDatabase() {
  client = new MongoClient(URL);
  await client.connect();
  console.log("Connected to database");
}

// Fetch all movies
app.get("/movie/get-movies", async (req, res, next) => {
  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movies = await collection.find({}).toArray();
    res.json(movies);
  } catch (error) {
    next(error);
  }
});

// Fetch a specific movie by ID
app.get("/movie/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (error) {
    next(error);
  }
});

// Book a movie
app.post("/movie/book-movie", async (req, res, next) => {
  const bookingRequest = req.body;

  if (
    !bookingRequest.movieId ||
    !bookingRequest.showId ||
    !bookingRequest.seats ||
    !bookingRequest.name ||
    !bookingRequest.email ||
    !bookingRequest.phoneNumber
  ) {
    return res.status(400).json({ message: "Some fields are missing" });
  }

  const requestedSeat = parseInt(bookingRequest.seats);
  if (isNaN(requestedSeat) || requestedSeat <= 0) {
    return res.status(400).json({ message: "Invalid seat count" });
  }

  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movie = await collection.findOne({ _id: new ObjectId(bookingRequest.movieId) });

    if (!movie) {
      return res.status(404).json({ message: "Requested movie not found" });
    }

    const show = Object.values(movie.shows)
      .flat()
      .find((s) => s.id === bookingRequest.showId);

    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    if (parseInt(show.seats) < requestedSeat) {
      return res.status(409).json({ message: "Not enough seats available" });
    }

    const updateSeats = parseInt(show.seats) - requestedSeat;
    const date = Object.keys(movie.shows).find((d) =>
      movie.shows[d].some((s) => s.id === bookingRequest.showId)
    );

    const showIndex = movie.shows[date].findIndex((s) => s.id === bookingRequest.showId);
    const userBooking = {
      name: bookingRequest.name,
      email: bookingRequest.email,
      phoneNumber: bookingRequest.phoneNumber,
      seats: bookingRequest.seats,
    };

    const updatedResult = await collection.updateOne(
      { _id: new ObjectId(bookingRequest.movieId) },
      {
        $set: { [`shows.${date}.${showIndex}.seats`]: updateSeats },
        $push: { [`shows.${date}.${showIndex}.bookings`]: userBooking },
      }
    );

    if (updatedResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update" });
    }

    return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
app.listen(8000, async () => {
  await connectToDatabase();
  console.log("Server is running on port 8000");
});
