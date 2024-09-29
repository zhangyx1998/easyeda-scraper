import fs from 'fs';
import archiver from 'archiver';
import path from 'path';

export async function zipDirectories(directories, outputZipPath) {
  await new Promise((resolve, reject) => {
    // Create a write stream for the zip file
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Set compression level
    });

    // Listen for the close event to resolve the promise
    output.on('close', () => {
      console.log(`Archive created successfully, ${archive.pointer()} total bytes.`);
      resolve();
    });

    // Handle errors during archiving
    archive.on('error', (err) => {
      reject(new Error(`Failed to create archive: ${err.message}`));
    });

    // Pipe the archive data to the file
    archive.pipe(output);

    // Append each path to the archive (handle both files and directories)
    directories.forEach((dir) => {
      const fullPath = path.resolve(dir); // Get absolute path
      if (fs.lstatSync(fullPath).isDirectory()) {
        console.log(`Adding directory: ${fullPath}`);
        archive.directory(fullPath, path.basename(fullPath)); // Append the directory to the zip
      } else if (fs.lstatSync(fullPath).isFile()) {
        console.log(`Adding file: ${fullPath}`);
        archive.file(fullPath, { name: path.basename(fullPath) }); // Append the file to the zip
      }
    });

    // Finalize the archive
    archive.finalize();
  });
}
