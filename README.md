# EasyEDA Part Scraper

**A tool to scrape and display part information from EasyEDA's LCSC library.**

This application is built using Electron and provides a simple interface to view part details such as part number, manufacturer, datasheet, and images.

## Project Structure

- `package.json` - Lists the app's details and dependencies.
- `main.js` - Starts the app and handles the main process logic.
- `index.html` - The web page rendered in the app's window.
- `renderer.js` - Handles the renderer process logic.

## To Use

To clone and run this repository, you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

```bash
# Clone this repository
git clone <your-repo-url>
# Go into the repository
cd easyeda-part-scraper
# Install dependencies
npm install
# Run the app
npm start
```

## Features

- Displays part information from the LCSC library
- Provides links to datasheets
- Shows part images

## License

[CC0 1.0 (Public Domain)](LICENSE.md)
