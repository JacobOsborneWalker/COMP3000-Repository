# COMP3000-Repository
Code for a remote  device detection tool to allow for layer 2 network scanning across multiple sites simultaniously.

DB - stores the SQLite file used as the main datasbase. 
Scanner Code - Stores all the code to be deployed on the raspberry Pi devices to allow for scanning and sanitisation. 



Server Code - All the code for the core server, handling all features from RBAC enforcement to initiating scan reqeuests.

Server Files 
- app.py - main entry point for the entire server. When the application is started, this is the file that runs.
- config.py - stores all the application settings read from the env file such as secret keys used to sign JWTs
- models.py - Defines every table in the database as a Python class. Each class maps directly to a table in the database.
- auth.py - Handles everything to do with user identity. The login endpoint receives credentials, finds the user and  verifies the password with bcrypt. it then issues a JWT containing the users ID and role.
- auth middleware.py - checks the specific routes against the JWT role access to prevent users from accessing parts they shoudlnt.
- encryption.py - Handles field level encryption for sensitive data stored in the database. It uses Fernet, which is a symmetric encryption scheme
- retention.py - automaticaly tuns in the background to delete old data from the database, thats over 90 years old.
- seed.py - seeds the initial database with the users, nodes and known devices as well as geenrates API keys.
- manage kesy.py - file for managing API keys without reseeding the database. 

Route Files 
- requests.py - manages the scan requests. It handles creating requests, listing requests and approving requests. 
- nodes.py - handles dashboard API and scanner API. It listens to scanners, registers new once and check in and polls.
- results.py - handles fetching completed scans for dispay. it decrypts information and looks up mac adresses agains known list before recalculating the list based on known devices.
- known devices.py - CRUD for known device registery.

Sprint Nodes - All the meetings from past sprints
- pi main.py - runs the scanner and does initial checks to test the server is online. Checks in every 60 seconds and checks for awaiting scans every 30 seconds. 
- pi config.py - stores the server URl and scanner UIDs and API keys. Additionally holds the scan mode for testing.
- Pi poller.py - asks the server for approved scans via the client. then it runs the scans trhough the scanner code, and submits the results.
- pi scanner.py - actuall runs the scans. checks the tools are working, and then stores the results as a database file.
- pi kismet parser.py - translates the database file into normalised device dictionaries that the rest of the system works with.
- pi analyser.py - analsyses the results of the files to produce flags for things suspicious such as probe SSIDs, high signal variance or non-standard beacon intervalls.
- pi uploader.py - packages the scan results and sends it to the server. ENsures all fields are present and normalises the flag field to a string. Also sends warning checkings to the server.
- pi client.py - handles URL constructions, and error handling. all network errors are caughed and logged so a temporary network outage doesnt crash the scanner. 

Screenshots - Examples of screenshots of the application used during development
