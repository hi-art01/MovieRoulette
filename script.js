// --- DOM Elements ---
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const findMovieBtn = document.getElementById('find-movie-btn');
const movieDisplay = document.getElementById('movie-display');
const settingsForm = document.getElementById('settings-form');
const genreSelect = document.getElementById('genre');
const startYearInput = document.getElementById('start-year');
const endYearInput = document.getElementById('end-year');
const customUrlInput = document.getElementById('custom-url');

// --- API Configuration ---
// ************************************************************************************
// IMPORTANT: This is the user's API key. DO NOT commit this to a public repository!
// Replace this with a secure method like an environment variable before publishing.
// ************************************************************************************
const apiKey = ' If so, you can get a free key by visiting their website at https://www.omdbapi.com/apikey.aspx.';
const apiUrl = `https://www.omdbapi.com/?apikey=${apiKey}`;

// --- Genre Options ---
const genres = [
    'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance'
];

// --- Event Listeners ---
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

findMovieBtn.addEventListener('click', findRandomMovie);

settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
    settingsPanel.classList.add('hidden');
});

// --- Functions ---

/**
 * Populates the genre dropdown with options.
 */
function populateGenres() {
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.toLowerCase();
        option.textContent = genre;
        genreSelect.appendChild(option);
    });
}

/**
 * Saves the user's settings to local storage.
 */
function saveSettings() {
    const settings = {
        genre: genreSelect.value,
        startYear: startYearInput.value,
        endYear: endYearInput.value,
        customUrl: customUrlInput.value
    };
    localStorage.setItem('movieSettings', JSON.stringify(settings));
}

/**
 * Loads settings from local storage and populates the form.
 */
function loadSettings() {
    const savedSettings = localStorage.getItem('movieSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        genreSelect.value = settings.genre;
        startYearInput.value = settings.startYear;
        endYearInput.value = settings.endYear;
        customUrlInput.value = settings.customUrl;
    }
}

/**
 * Fetches a random movie from the OMDb API based on user settings.
 */
async function findRandomMovie() {
    if (apiKey === 'YOUR_API_KEY') {
        alert('Please enter your OMDb API key in the settings.');
        return;
    }

    const { genre, startYear, endYear } = JSON.parse(localStorage.getItem('movieSettings')) || {};

    // 1. Search for movies using the genre as a keyword and fetch multiple pages
    let allMovies = [];
    for (let page = 1; page <= 3; page++) { // Fetch first 3 pages
        const searchResponse = await fetch(`${apiUrl}&s=${genre || 'movie'}&type=movie&page=${page}`);
        const searchData = await searchResponse.json();
        if (searchData.Search) {
            allMovies = allMovies.concat(searchData.Search);
        }
    }

    if (allMovies.length === 0) {
        alert('No movies found for the selected criteria. Please try a different genre.');
        return;
    }

    // 2. Filter the results by year
    let filteredMovies = allMovies;
    if (startYear) {
        filteredMovies = filteredMovies.filter(movie => parseInt(movie.Year) >= startYear);
    }
    if (endYear) {
        filteredMovies = filteredMovies.filter(movie => parseInt(movie.Year) <= endYear);
    }

    if (filteredMovies.length === 0) {
        alert('No movies found for the selected year range. Please adjust your settings.');
        return;
    }

    // 3. Select a random movie from the filtered list
    const randomMovie = filteredMovies[Math.floor(Math.random() * filteredMovies.length)];

    // 4. Fetch detailed information for the selected movie
    const detailsResponse = await fetch(`${apiUrl}&i=${randomMovie.imdbID}`);
    const movieData = await detailsResponse.json();

    // 5. Display the movie
    displayMovie(movieData);
}

/**
 * Displays the movie data on the page.
 * @param {object} movie - The movie data object from the OMDb API.
 */
function displayMovie(movie) {
    movieDisplay.innerHTML = `
        <img src="${movie.Poster}" alt="${movie.Title} Poster">
        <h2>${movie.Title}</h2>
        <p><strong>Year:</strong> ${movie.Year}</p>
        <p><strong>Genre:</strong> ${movie.Genre}</p>
    `;

    // Copy to clipboard and open custom URL
    const settings = JSON.parse(localStorage.getItem('movieSettings'));
    if (settings && settings.customUrl) {
        navigator.clipboard.writeText(movie.Title).then(() => {
            window.open(settings.customUrl, '_blank');
        });
    }
}

// --- Initialization ---
populateGenres();
loadSettings();
