#LUNA

Luna is a server-side application that will allow users to create synchronized video streams without needing an account. It runs on the Node.JS framework.

Luna is currently up and running over at [http://luna.berrypunch.net](http://luna.berrypunch.net).

---

##Running your own LUNA instance

Luna runs on top of node.js, a working install of node.js (Luna was developed with node.js version 0.10.26) is required. Once that's configured, running Luna is extremely easy.

 1. Open your terminal and browse to Luna's root directory (where package.json resides).
 2. Type in `npm install` to install Luna's dependencies.
 3. Luna needs to know which port it should run on. In order to do this, create a file called `options.json` in the root Luna directory. It should look something like this:
 
        {
        "port": 9002    
        }

 4. Start Luna by typing `node luna.js` in your terminal. Luna should start automatically and display some text when everything went according to plan.
 5. Visit http://yourwebserver:YOURPORT to create new streams!
 6. Every stream has a control string, this will get generated and given to the owner when the stream is created. You have to use the combination of the URL + control link in order to control the stream.
 7. There's a test stream called 'teststream' (access it via http://yourwebserver:YOURPORT/streams/teststream#control=test). You can remove it by deleting teststream.json from the /streams/ directory.
