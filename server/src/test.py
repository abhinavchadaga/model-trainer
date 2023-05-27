import sys
import json
import time

# Read the input from Node.js
data = json.loads(sys.stdin.read())

# Process the data and update as needed
for i in range(1, 21):
    data["progress"] = data["progress"] + 1
    # Send the updated data back to Node.js
    sys.stdout.write(json.dumps(data))
    sys.stdout.flush()
    time.sleep(1)
