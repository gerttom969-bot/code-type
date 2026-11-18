// Static, version-controlled learning content. User data is stored separately.
export const catalog = {
  snippets: [
    { id: 1, file: "comprehension.py", topic: "python", title: "List comprehension", difficulty: "easy",
      docs: "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions",
      code: "squares = [x * x for x in range(10) if x % 2 == 0]\nprint(squares)" },
    { id: 2, file: "routes.py", topic: "fastapi", title: "FastAPI GET route", difficulty: "easy",
      docs: "https://fastapi.tiangolo.com/tutorial/first-steps/",
      code: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/items/{item_id}")\nasync def read_item(item_id: int, q: str | None = None):\n    return {"item_id": item_id, "q": q}' },
    { id: 3, file: "models.py", topic: "django", title: "Django model", difficulty: "easy",
      docs: "https://docs.djangoproject.com/en/stable/topics/db/models/",
      code: "from django.db import models\n\nclass Article(models.Model):\n    title = models.CharField(max_length=200)\n    published = models.DateTimeField(auto_now_add=True)\n\n    def __str__(self):\n        return self.title" },
    { id: 4, file: "tasks.py", topic: "asyncio", title: "Async gather", difficulty: "medium",
      docs: "https://docs.python.org/3/library/asyncio-task.html#asyncio.gather",
      code: "import asyncio\n\nasync def fetch(n):\n    await asyncio.sleep(0.1)\n    return n * 2\n\nasync def main():\n    results = await asyncio.gather(*[fetch(i) for i in range(5)])\n    print(results)\n\nasyncio.run(main())" },
    { id: 5, file: "strings.py", topic: "python", title: "f-string formatting", difficulty: "easy",
      docs: "https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals",
      code: 'name = "world"\ngreeting = f"Hello, {name}!"\nprice = 19.99\nmsg = f"Total: ${price:.2f}"\nprint(greeting)\nprint(msg)' }
  ],
  midSnippets: [
    { id: 101, file: "greet.py", title: "Default argument",
      template: "def greet(name=@@1@@):\n    return f'Hello, {@@2@@}!'\nprint(greet())",
      blanks: ["'world'", "name"] },
    { id: 102, file: "range.py", title: "Loop with range",
      template: "for i in range(@@1@@):\n    print(i * @@2@@)",
      blanks: ["5", "2"] },
    { id: 103, file: "filter.py", title: "List filter",
      template: "evens = [x for x in range(10) if x % @@1@@ == @@2@@]\nprint(evens)",
      blanks: ["2", "0"] },
    { id: 104, file: "dict.py", title: "Dict access",
      template: "data = {'name': 'Alice', 'age': 30}\nprint(data[@@1@@])",
      blanks: ["'name'"] },
    { id: 105, file: "try.py", title: "Try/except",
      template: "try:\n    result = 10 / @@1@@\nexcept @@2@@:\n    print('Caught!')",
      blanks: ["0", "ZeroDivisionError"] },
    { id: 106, file: "sq.py", title: "Sum of squares",
      template: "nums = [1, 2, 3, 4]\ntotal = sum(@@1@@ for x in nums)\nprint(total)",
      blanks: ["x * x"] }
  ],
  hardProblems: [
    { slug: "climbing-stairs", title: "Climbing Stairs",
      description: "You're climbing a staircase with n steps. Each move you take 1 or 2 steps. In how many distinct ways can you reach the top?",
      examples: [
        { input: "n = 2", output: "2", explanation: "1+1 or 2" },
        { input: "n = 3", output: "3", explanation: "1+1+1, 1+2, 2+1" }
      ],
      hints: [
        "Look at the last move: it's either 1 step or 2 steps.",
        "So ways(n) = ways(n-1) + ways(n-2). Fibonacci!",
        "Base cases: ways(1)=1, ways(2)=2."
      ],
      starter: "class Solution:\n    def climb_stairs(self, n):\n        pass\n",
      tests: "sol = Solution()\nassert sol.climb_stairs(2) == 2\nassert sol.climb_stairs(3) == 3\nassert sol.climb_stairs(5) == 8\nprint('ALL_PASSED')" },
    { slug: "longest-substring", title: "Longest Substring",
      description: "Given a string s, find the length of the longest substring without repeating characters.",
      examples: [
        { input: 's = "abcabcbb"', output: "3", explanation: '"abc"' },
        { input: 's = "bbbbb"', output: "1", explanation: '"b"' },
        { input: 's = "pwwkew"', output: "3", explanation: '"wke"' }
      ],
      hints: [
        "Use a sliding window [left, right].",
        "When you see a repeat, shrink from the left until it's gone.",
        "Track last-seen index per character to skip ahead."
      ],
      starter: "class Solution:\n    def length_of_longest(self, s):\n        pass\n",
      tests: "sol = Solution()\nassert sol.length_of_longest('abcabcbb') == 3\nassert sol.length_of_longest('bbbbb') == 1\nassert sol.length_of_longest('pwwkew') == 3\nprint('ALL_PASSED')" },
    { slug: "product-except-self", title: "Product Except Self",
      description: "Given an integer array nums, return an array where output[i] is the product of all elements except nums[i]. O(n), no division.",
      examples: [
        { input: "nums = [1,2,3,4]", output: "[24,12,8,6]", explanation: "" },
        { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]", explanation: "" }
      ],
      hints: [
        "You can't use division — multiply left products and right products separately.",
        "left[i] = product of nums[0..i-1].",
        "Then multiply in right products on the fly, right-to-left."
      ],
      starter: "class Solution:\n    def product_except_self(self, nums):\n        pass\n",
      tests: "sol = Solution()\nassert sol.product_except_self([1,2,3,4]) == [24,12,8,6]\nassert sol.product_except_self([-1,1,0,-3,3]) == [0,0,9,0,0]\nprint('ALL_PASSED')" }
  ],
  proProblems: [
    { slug: "watermelon", title: "Watermelon", rating: 800, source: "Codeforces 4A",
      description: "Pete and Billy want to divide a watermelon weighing w kilos into two parts, each weighing an even number > 0. Is it possible?",
      input_spec: "One integer w (1 ≤ w ≤ 100).",
      output_spec: "YES or NO.",
      examples: [
        { input: "8", output: "YES", explanation: "8 = 2 + 6" },
        { input: "5", output: "NO", explanation: "" },
        { input: "2", output: "NO", explanation: "1 + 1, both odd" }
      ],
      hints: ["Try small even values: 2, 4, 6, 8.", "What's special about 2?", "w must be even AND > 2."],
      starter: "w = int(input())\n# print YES or NO\n",
      tests: [
        { input: "8", expected: "YES" },
        { input: "5", expected: "NO" },
        { input: "2", expected: "NO" },
        { input: "4", expected: "YES" }
      ] },
    { slug: "team", title: "Team", rating: 800, source: "Codeforces 231A",
      description: "Three friends know solutions to different problems. A problem is solved if at least 2 of them know it. Given n problems, count how many they solve together.",
      input_spec: "First line: n. Then n lines with three integers (0 or 1).",
      output_spec: "Count of problems solved.",
      examples: [
        { input: "3\n1 1 0\n1 1 1\n1 0 0", output: "2", explanation: "Problems 1 and 2 have ≥2 ones" }
      ],
      hints: ["Sum each row.", "If sum ≥ 2, increment counter.", "Read all input with input() in a loop."],
      starter: "n = int(input())\ncount = 0\nfor _ in range(n):\n    a, b, c = map(int, input().split())\n    # if a+b+c >= 2: count += 1\nprint(count)\n",
      tests: [
        { input: "3\n1 1 0\n1 1 1\n1 0 0", expected: "2" },
        { input: "1\n0 0 0", expected: "0" },
        { input: "1\n1 1 1", expected: "1" }
      ] },
    { slug: "bit-plus-plus", title: "Bit++", rating: 800, source: "Codeforces 282A",
      description: "Variable x starts at 0. Statements '++X' or 'X++' increment x; '--X' or 'X--' decrement it. Given n statements, output final x.",
      input_spec: "First line: n. Then n lines with one of: ++X, X++, --X, X--.",
      output_spec: "Final value of x.",
      examples: [
        { input: "2\n++X\nX--", output: "0", explanation: "0 → 1 → 0" }
      ],
      hints: ["Only the '+' or '-' matters.", "Check if '+' is in the string.", "Use `'+' in s`."],
      starter: "n = int(input())\nx = 0\nfor _ in range(n):\n    s = input()\n    # if '+' in s: x += 1 else: x -= 1\nprint(x)\n",
      tests: [
        { input: "2\n++X\nX--", expected: "0" },
        { input: "1\n++X", expected: "1" },
        { input: "1\n--X", expected: "-1" }
      ] },
    { slug: "next-round", title: "Next Round", rating: 800, source: "Codeforces 158A",
      description: "n participants with scores. A contestant advances if their score is > 0 AND >= the k-th place score. Count how many advance.",
      input_spec: "Line 1: n and k. Line 2: n scores.",
      output_spec: "Number of advancing contestants.",
      examples: [
        { input: "8 5\n10 9 8 7 7 7 5 5", output: "6", explanation: "k-th score = 7" },
        { input: "4 2\n0 0 0 0", output: "0", explanation: "All zeros" }
      ],
      hints: ["threshold = scores[k-1].", "Count scores >= threshold AND > 0."],
      starter: "n, k = map(int, input().split())\nscores = list(map(int, input().split()))\nthreshold = scores[k - 1]\n# count scores >= threshold and > 0\nprint(0)\n",
      tests: [
        { input: "8 5\n10 9 8 7 7 7 5 5", expected: "6" },
        { input: "4 2\n0 0 0 0", expected: "0" },
        { input: "1 1\n5", expected: "1" }
      ] }
  ],
  problems: [
    { slug: "two-sum", title: "Two Sum", difficulty: "easy",
      docs: "https://docs.python.org/3/tutorial/datastructures.html#dictionaries",
      description: "Given nums and target, return indices of the two numbers that add up to target.",
      starter: "class Solution:\n    def two_sum(self, nums, target):\n        pass\n",
      tests: "sol = Solution()\nassert sol.two_sum([2,7,11,15], 9) == [0,1]\nassert sol.two_sum([3,2,4], 6) == [1,2]\nassert sol.two_sum([3,3], 6) == [0,1]\nprint('ALL_PASSED')" },
    { slug: "reverse-string", title: "Reverse String", difficulty: "easy",
      docs: "https://docs.python.org/3/tutorial/datastructures.html#more-on-lists",
      description: "Return the reversed list of characters.",
      starter: "class Solution:\n    def reverse_string(self, s):\n        pass\n",
      tests: "sol = Solution()\nassert sol.reverse_string(list('hello')) == list('olleh')\nassert sol.reverse_string(list('abc')) == list('cba')\nprint('ALL_PASSED')" },
    { slug: "fizzbuzz", title: "FizzBuzz", difficulty: "medium",
      docs: "https://docs.python.org/3/tutorial/controlflow.html#if-statements",
      description: "Return list 1..n with Fizz/Buzz/FizzBuzz substitutions.",
      starter: "class Solution:\n    def fizzbuzz(self, n):\n        pass\n",
      tests: "sol = Solution()\nassert sol.fizzbuzz(3) == ['1','2','Fizz']\nassert sol.fizzbuzz(5) == ['1','2','Fizz','4','Buzz']\nprint('ALL_PASSED')" },
    { slug: "valid-parens", title: "Valid Parentheses", difficulty: "easy",
      docs: "https://docs.python.org/3/tutorial/datastructures.html#using-lists-as-stacks",
      description: "Determine if brackets close in correct order.",
      starter: "class Solution:\n    def is_valid(self, s):\n        pass\n",
      tests: "sol = Solution()\nassert sol.is_valid('()') == True\nassert sol.is_valid('()[]{}') == True\nassert sol.is_valid('(]') == False\nprint('ALL_PASSED')" },
    { slug: "max-subarray", title: "Max Subarray", difficulty: "medium",
      docs: "https://docs.python.org/3/library/functions.html#max",
      description: "Find the contiguous subarray with the largest sum (Kadane).",
      starter: "class Solution:\n    def max_subarray(self, nums):\n        pass\n",
      tests: "sol = Solution()\nassert sol.max_subarray([-2,1,-3,4,-1,2,1,-5,4]) == 6\nassert sol.max_subarray([1]) == 1\nprint('ALL_PASSED')" }
  ],
  projects: [
    { slug: "fastapi-todo", title: "FastAPI Todo API", difficulty: "medium",
      description: "Full CRUD REST API with SQLite. Auto-generated OpenAPI docs.",
      docs: "https://fastapi.tiangolo.com/tutorial/",
      files: [{ path: "main.py", code: "from fastapi import FastAPI\nfrom pydantic import BaseModel\nimport sqlite3\n\napp = FastAPI()\nDB = 'todos.db'\n\ncon = sqlite3.connect(DB)\ncon.execute('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT, done INT)')\ncon.commit(); con.close()\n\nclass TodoIn(BaseModel):\n    title: str\n    done: bool = False\n\n@app.get('/todos')\ndef list_todos():\n    con = sqlite3.connect(DB)\n    rows = con.execute('SELECT * FROM todos').fetchall()\n    con.close()\n    return [{'id': r[0], 'title': r[1], 'done': bool(r[2])} for r in rows]\n\n@app.post('/todos', status_code=201)\ndef create(body: TodoIn):\n    con = sqlite3.connect(DB)\n    cur = con.execute('INSERT INTO todos (title, done) VALUES (?,?)', (body.title, int(body.done)))\n    con.commit(); con.close()\n    return {'id': cur.lastrowid}\n" }],
      commands: ["python -m venv .venv", "pip install fastapi uvicorn[standard]", "uvicorn main:app --reload"],
      gitCommands: ["git init", "git add .", 'git commit -m "feat: FastAPI todo"', 'gh repo create codetype-todo --public --source=. --push'] },
    { slug: "django-blog", title: "Django Blog", difficulty: "medium",
      description: "Models, views, URLs, admin.",
      docs: "https://docs.djangoproject.com/en/stable/intro/tutorial01/",
      files: [{ path: "blog/models.py", code: "from django.db import models\n\nclass Post(models.Model):\n    title = models.CharField(max_length=200)\n    body = models.TextField()\n    published = models.DateTimeField(auto_now_add=True)\n" }],
      commands: ["pip install django", "django-admin startproject mysite", "cd mysite && python manage.py startapp blog"],
      gitCommands: ["git init", "git add .", 'git commit -m "feat: Django blog"', 'gh repo create codetype-blog --public --source=. --push'] },
    { slug: "python-cli", title: "Python CLI Tool", difficulty: "easy",
      description: "Real argparse CLI with subcommands.",
      docs: "https://docs.python.org/3/library/argparse.html",
      files: [{ path: "cli.py", code: "import argparse\n\ndef main():\n    p = argparse.ArgumentParser()\n    sub = p.add_subparsers(dest='cmd', required=True)\n    a = sub.add_parser('add')\n    a.add_argument('key'); a.add_argument('value')\n    args = p.parse_args()\n    print(args)\n\nif __name__ == '__main__':\n    main()\n" }],
      commands: ["python cli.py add foo bar", "pip install -e ."],
      gitCommands: ["git init", "git add .", 'git commit -m "feat: CLI"', 'gh repo create codetype-cli --public --source=. --push'] }
  ],
  peers: [
    { username: "alice_dev", xp: 1240, level: 5 },
    { username: "bob_codes", xp: 870, level: 4 },
    { username: "carol_ops", xp: 640, level: 4 },
    { username: "dave_async", xp: 480, level: 3 },
    { username: "eve_fast", xp: 350, level: 3 }
  ]
};
