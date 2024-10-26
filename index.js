const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();

const app = express();
const URL = process.env.DB;
const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

// Middleware setup
app.use(cors({ origin: "*" }));
app.use(express.json());

// Get all movies
app.get("/movie/get-movies", async (req, res) => {
  try {
    const client = new MongoClient(URL);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const movies = await collection.find({}).toArray();
    res.json(movies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  } finally {
    await client.close();
  }
});

// Get a movie by ID
app.get("/movie/:id", async (req, res) => {
  const id = req.params.id;

  // Check if the provided ID is a valid ObjectId
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    const client = new MongoClient(URL);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }
    
    res.json(movie);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  } finally {
    await client.close();
  }
});

// Book a movie
app.post("/movie/book-movie", async (req, res) => {
  const bookingRequest = req.body;

  // Validate input fields
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

  // Check if the provided movieId is a valid ObjectId
  if (!ObjectId.isValid(bookingRequest.movieId)) {
    return res.status(400).json({ message: "Invalid Movie ID format" });
  }

  try {
    const client = new MongoClient(URL);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Fetch movie by ID
    const movie = await collection.findOne({
      _id: new ObjectId(bookingRequest.movieId),
    });

    if (!movie) {
      return res.status(404).json({ message: "Requested movie not found" });
    }

    // Find show by `showId`
    const show = Object.values(movie.shows)
      .flat()
      .find((s) => s.id === bookingRequest.showId);

    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    // Check seat availability
    if (parseInt(show.seats) < requestedSeat) {
      return res.status(400).json({ message: "Not enough seats available" });
    }

    // Update available seats and add booking
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

    res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  } finally {
    await client.close();
  }
});

// Start server
app.listen(process.env.PORT || 8000, () => {
  console.log("Server is running on port", process.env.PORT || 8000);
});
