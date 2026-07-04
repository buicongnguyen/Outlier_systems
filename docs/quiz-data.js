// Quiz bank for systems-skills.html.
// Format: quizData.{db,os,dist,net,infra} = [{ q, options: [[text, isCorrect]...], explain }]
// Question types: default single-answer; type:"multi" (exact-set multi-select);
// type:"order" ({ steps: [...] } in correct order, shuffled for display).
const quizData = {
  db: [
    {
      q: "A query does SELECT * FROM orders WHERE customer_id = 42 on a 100M-row table and takes 30 seconds. The most likely fix is:",
      options: [
        ["Add an index on customer_id, turning the full table scan into an index seek of just the matching rows", true],
        ["Increase the database server's RAM so the whole table fits in memory", false],
        ["Switch the table to columnar storage", false],
        ["Wrap the query in a transaction so the database can optimize it", false]
      ],
      explain: "Without an index on customer_id the database must scan all 100M rows to find matches. A B-tree index lets it seek directly to customer 42's entries in a handful of page reads. EXPLAIN would show the plan changing from Seq Scan to Index Scan; RAM helps rescans but doesn't fix the algorithmic problem, and columnar storage targets analytics, not point lookups."
    },
    {
      q: "Why does a database acknowledge a commit after flushing the WAL but before updating the actual data pages on disk?",
      options: [
        ["The WAL append is a sequential write and contains everything needed to redo the change after a crash — data pages can be updated lazily", true],
        ["Data pages are read-only during transactions and can only be written at checkpoints", false],
        ["The WAL is stored in RAM so it is faster to update", false],
        ["It cannot — commits always require the data pages to be written first", false]
      ],
      explain: "Durability only requires that the change survive a crash, and the fsynced WAL record guarantees that: recovery replays the log to rebuild the pages. Sequential log appends are far cheaper than the random I/O of updating scattered data pages, which is deferred to checkpoints. This is the core design of ARIES-style recovery used by essentially every serious database."
    },
    {
      q: "Under snapshot isolation (repeatable read), two transactions each read that 2 doctors are on call, and each removes a different doctor. Both commit. The hospital now has 0 doctors on call despite a rule requiring at least 1. What is this anomaly?",
      options: [
        ["Write skew — the transactions wrote disjoint rows so snapshot isolation saw no conflict, but together they violated the invariant", true],
        ["Dirty read — each transaction read the other's uncommitted write", false],
        ["Lost update — the second commit overwrote the first", false],
        ["Phantom read — new rows appeared between the reads", false]
      ],
      explain: "Each transaction's writes touched a different row, so first-committer-wins conflict detection fires on neither — yet the combined effect breaks the invariant both checked. That is write skew, the signature anomaly snapshot isolation permits. Fixes: SERIALIZABLE isolation, or SELECT ... FOR UPDATE to materialize the conflict on the rows read."
    },
    {
      q: "An index exists on (tenant_id, created_at). Which query can NOT use it effectively?",
      options: [
        ["SELECT ... WHERE created_at > '2026-01-01' — no tenant_id predicate, so the leftmost index column is unconstrained", true],
        ["SELECT ... WHERE tenant_id = 7 AND created_at > '2026-01-01'", false],
        ["SELECT ... WHERE tenant_id = 7 ORDER BY created_at DESC LIMIT 10", false],
        ["SELECT ... WHERE tenant_id = 7", false]
      ],
      explain: "A composite B-tree is sorted by tenant_id first, then created_at within each tenant — like a phone book sorted by last name then first. A predicate on created_at alone would have to look inside every tenant's range, so the planner falls back to a scan (or a separate index). The leftmost-prefix rule decides composite column order."
    },
    {
      q: "Why do LSM-tree engines (RocksDB, Cassandra) sustain much higher write throughput than B-tree engines?",
      options: [
        ["Writes are buffered in a memtable and flushed as sequential SSTable files — no random in-place page updates on the write path", true],
        ["They skip writing to disk entirely and rely on replication for durability", false],
        ["They compress data harder, so there is physically less to write", false],
        ["They use faster hash indexes instead of trees", false]
      ],
      explain: "An LSM write is a WAL append plus an in-memory insert; sorted runs are flushed sequentially and merged by background compaction. B-trees must eventually update pages in place, which is random I/O and page splits. The bill arrives elsewhere: LSM reads may consult several SSTables (mitigated by bloom filters) and compaction consumes background I/O."
    },
    {
      q: "A user updates their profile, and the app immediately reads it back — but shows the old value. The app writes to the primary and reads from replicas. What happened?",
      options: [
        ["Replication lag — the read hit a replica that hadn't yet applied the write; route read-your-own-writes traffic to the primary or a caught-up replica", true],
        ["The transaction was rolled back silently", false],
        ["The B-tree index was corrupted by the concurrent read", false],
        ["MVCC showed the reader an old snapshot and always will until VACUUM runs", false]
      ],
      explain: "Async replicas trail the primary by some lag, so a read immediately after a write can see the pre-write state — the classic read-your-own-writes violation. Standard fixes: pin the writing user's reads to the primary briefly, use session consistency tokens, or read from replicas known to have applied your write's LSN."
    },
    {
      q: "What does MVCC buy a database, compared to locking readers and writers against each other?",
      options: [
        ["Readers see a consistent snapshot without blocking writers, and writers don't block readers — long reads and OLTP writes coexist", true],
        ["All transactions become serializable automatically", false],
        ["Writes become faster because no undo information is kept", false],
        ["It eliminates the need for a WAL", false]
      ],
      explain: "Under MVCC, writers create new row versions and readers use the version visible to their snapshot, so a long analytics query doesn't stall updates and updates don't corrupt the query's view. It is not free — old versions must be vacuumed/purged — and it does not give serializability by itself (see write skew)."
    },
    {
      q: "When is denormalization the right call?",
      options: [
        ["When a measured read path is dominated by joins, and you accept keeping the copies consistent on every write in exchange", true],
        ["Always — joins are obsolete on modern hardware", false],
        ["Never — third normal form is a correctness requirement", false],
        ["Whenever a table exceeds one million rows", false]
      ],
      explain: "Normalization stores each fact once, making updates trivially consistent; denormalization duplicates data to remove join cost from hot reads. The duplicate copies must now be updated together (more write code, more room for drift), so it's a deliberate, measured trade — commonplace in read-heavy views, feeds, and analytics projections."
    },
    {
      q: "Two transactions deadlock: T1 locked row A and wants row B; T2 locked row B and wants row A. What does the database do?",
      options: [
        ["Detects the wait-for cycle and aborts one transaction as the victim; the application should catch the error and retry it", true],
        ["Waits until one transaction times out its connection", false],
        ["Grants both locks in shared mode so both can proceed", false],
        ["Merges the two transactions into one", false]
      ],
      explain: "Databases maintain a wait-for graph and abort a victim when a cycle appears (deadlock detection), returning an error like Postgres's 40P01. The application-level cure is prevention: touch rows in a consistent order across code paths, keep transactions short, and always be prepared to retry serialization/deadlock errors."
    },
    {
      q: "Why are analytics warehouses (ClickHouse, BigQuery, Redshift) column-oriented?",
      options: [
        ["Scans read only the few columns the query touches, and same-typed column runs compress far better — both slash I/O for aggregations over billions of rows", true],
        ["Columns allow row-level locking at finer granularity", false],
        ["Column storage makes single-row inserts and updates faster", false],
        ["It is required for SQL window functions to work", false]
      ],
      explain: "SELECT avg(amount) GROUP BY region over 2B rows touches 2 of maybe 60 columns; columnar layout reads just those, and delta/dictionary encodings compress homogeneous data 10x+. The mirror-image cost: reassembling a whole row is expensive and point updates are terrible — which is exactly the OLTP workload row stores serve."
    },
    {
      q: "A service opens a new database connection per HTTP request and collapses under load. Why is connection pooling the fix?",
      options: [
        ["Each connection costs a handshake and server-side memory (even a process in Postgres); a bounded pool reuses warm connections and caps concurrent load on the database", true],
        ["Pools batch multiple queries into one network packet", false],
        ["Pools make transactions unnecessary", false],
        ["Pools cache query results so the database is hit less", false]
      ],
      explain: "Connection setup is TCP + auth + TLS + server-side allocation — Postgres forks a backend process per connection. Thousands of short-lived connections burn CPU on churn, and unbounded concurrent connections exhaust database memory. A pool amortizes setup and, critically, acts as an admission-control valve; PgBouncer et al. exist for exactly this."
    },
    {
      q: "You need to store user sessions accessed only by session ID, at very high request rates. The natural storage choice is:",
      options: [
        ["A key-value store (Redis, DynamoDB) — the access pattern is pure get/put by key with no joins or cross-item queries", true],
        ["A graph database, since sessions relate to users", false],
        ["A columnar warehouse for fast scans", false],
        ["A relational database with five normalized tables per session", false]
      ],
      explain: "Choose the engine by access pattern. Sessions are self-contained blobs fetched by exact key at high QPS with TTL expiry — the textbook key-value workload. Relational engines can do it but add machinery you don't use; columnar and graph engines are optimized for entirely different query shapes."
    },
    {
      type: "multi",
      q: "Which of the following are guarantees provided by ACID transactions?",
      options: [
        ["Atomicity: either every statement's effect commits or none do", true],
        ["Durability: once committed, the changes survive a crash", true],
        ["Isolation: concurrent transactions don't see each other's intermediate states (to the degree of the isolation level)", true],
        ["Low latency: transactions always complete within a bounded time", false],
        ["Availability: the database keeps serving during network partitions", false]
      ],
      explain: "ACID is atomicity, consistency, isolation, durability — correctness guarantees, not performance or availability ones. Availability under partition is CAP's territory, and latency bounds are an SLO concern; a transaction can be perfectly ACID and slow."
    },
    {
      type: "multi",
      q: "Which statements about indexes are true?",
      options: [
        ["Every additional index slows down INSERT/UPDATE/DELETE, since each must be maintained", true],
        ["A covering index can answer a query without touching the table at all", true],
        ["Applying a function to the column in the WHERE clause (lower(email) = ...) prevents use of a plain index on that column", true],
        ["Indexes speed up all queries on the table, including unfiltered full scans", false],
        ["The planner always uses an index when one exists on the filtered column", false]
      ],
      explain: "Indexes are a write-cost-for-read-speed trade, covering indexes enable index-only scans, and wrapping the column in a function hides it from a plain index (index the expression instead). Full scans don't benefit, and the planner will skip an index when statistics say a scan is cheaper — e.g., low-selectivity predicates."
    },
    {
      type: "order",
      q: "Order the steps of how a committed UPDATE becomes durable and visible (WAL-based engine with MVCC):",
      steps: [
        "Transaction begins and acquires a snapshot",
        "UPDATE creates a new row version in the buffer pool and writes a redo record",
        "COMMIT: the WAL is flushed (fsync) to disk",
        "Commit is acknowledged to the client",
        "Later, a checkpoint writes the dirty data pages in place"
      ],
      explain: "The order is the whole durability story: the new version and its log record exist in memory first, the sequential WAL flush at commit is what makes it crash-proof, the client hears success only after that fsync, and the random-I/O page writes happen lazily at checkpoint time — recovery replays the WAL if a crash lands in between."
    }
  ],
  os: [
    {
      q: "What is the key difference between a process and a thread?",
      options: [
        ["Threads within a process share the address space (heap, globals); processes each have their own — isolation vs cheap shared-memory communication", true],
        ["Threads run only on one core; processes can use many", false],
        ["Processes are scheduled by the kernel, threads only by the application", false],
        ["Threads cannot make syscalls", false]
      ],
      explain: "A process is an address space plus resources; threads are execution streams inside it, each with its own stack and registers but sharing everything else. Sharing makes thread communication a pointer away — and makes data races possible. Kernel threads are scheduled by the kernel just like processes."
    },
    {
      q: "A program's throughput collapses and the machine shows high I/O wait with constant major page faults. What is happening?",
      options: [
        ["Thrashing — the working set exceeds RAM, so the OS continually evicts and reloads pages from disk instead of doing useful work", true],
        ["A deadlock between two of its threads", false],
        ["The TLB is full and must be rebuilt each context switch", false],
        ["The scheduler is giving the process too little CPU time", false]
      ],
      explain: "Major page faults mean memory accesses are being served from disk — milliseconds instead of nanoseconds. When the set of pages a program actively touches doesn't fit in RAM, eviction and reload chase each other and the CPU sits idle waiting on I/O. Fixes: more RAM, smaller working set, or better locality."
    },
    {
      q: "Two threads run counter++ 10,000 times each without synchronization; the final value is 13,847 instead of 20,000. Why?",
      options: [
        ["counter++ is a load, add, store sequence; interleaved executions overwrite each other's stores, losing increments — a data race", true],
        ["The compiler optimized away some increments", false],
        ["Integer overflow wrapped the counter", false],
        ["The OS scheduler dropped some of the threads' time slices", false]
      ],
      explain: "Both threads can load the same old value, each add 1, and store — one increment vanishes. This is the textbook lost update, and in C/C++ it is undefined behavior outright. Fix with an atomic fetch_add, a mutex, or per-thread counters summed at the end (fastest — no sharing)."
    },
    {
      q: "Why must a condition variable wait always be wrapped in a loop re-checking the predicate (while (!ready) cv.wait(lock)), not an if?",
      options: [
        ["Spurious wakeups are permitted, and another thread may consume the condition between signal and wakeup — only re-checking guarantees the predicate actually holds", true],
        ["The loop makes the wait use less CPU", false],
        ["cv.wait() returns immediately the first time it is called", false],
        ["An if statement cannot release the mutex", false]
      ],
      explain: "wait() may return without a signal (spurious wakeup), and even after a real signal, a third thread can grab the mutex first and falsify the condition again. The while loop makes the code correct regardless: wake, re-acquire the lock, re-test, and go back to sleep if the world isn't as promised."
    },
    {
      q: "Thread A does: data = 42; ready = true; (plain writes). Thread B spins until ready is true, then reads data — and sometimes sees 0. Why is this possible?",
      options: [
        ["Without atomics/barriers, the compiler and CPU may reorder the writes or the reads — plain memory accesses carry no cross-thread ordering guarantees", true],
        ["Thread B's cache is permanently stale until the OS flushes it", false],
        ["Booleans are not stored atomically on modern CPUs", false],
        ["The kernel batches memory writes from user processes", false]
      ],
      explain: "This is the memory-ordering trap: the store to ready can become visible before the store to data (compiler reordering, store buffers), and B's loads can be reordered or hoisted too. Making ready a release-store/acquire-load pair — or guarding both with a mutex, which provides exactly those semantics — forbids the reordering. Caches themselves are coherent; ordering is the issue."
    },
    {
      q: "What is the practical rule that prevents deadlock when code must hold two locks at once?",
      options: [
        ["Establish a global lock ordering and always acquire the locks in that order everywhere", true],
        ["Always sleep 1ms between acquiring the first and second lock", false],
        ["Use recursive mutexes so double-acquisition succeeds", false],
        ["Acquire the second lock before releasing the first", false]
      ],
      explain: "Deadlock needs a cycle in the wait-for graph; if every thread acquires locks in one agreed order (e.g., by address or ID), no cycle can form. The alternatives are try_lock-with-backoff or collapsing to one coarser lock. Sleeping just makes the race rarer, and recursive mutexes only help a thread re-lock its own mutex."
    },
    {
      q: "Why can an epoll-based event loop on one thread handle 100k concurrent connections when thread-per-connection cannot?",
      options: [
        ["Idle connections cost only a small kernel registration and a task object — no stack, no scheduler churn; the loop only does work for sockets that are actually ready", true],
        ["epoll makes network reads complete faster", false],
        ["The kernel processes the requests itself under epoll", false],
        ["Event loops use UDP internally to avoid connection state", false]
      ],
      explain: "100k threads means 100k stacks (gigabytes) and heavy context-switch pressure even when idle. epoll_wait returns just the ready sockets, so parked connections cost nearly nothing. The discipline it demands: never block the loop — one synchronous disk read or CPU-heavy handler stalls every connection behind it."
    },
    {
      q: "Eight threads each increment their own counter in an array: counts[thread_id]++. It scales terribly. The likely culprit is:",
      options: [
        ["False sharing — adjacent counters sit in the same 64-byte cache line, which ping-pongs between cores on every write; pad each counter to its own line", true],
        ["The counters overflow and trap into the kernel", false],
        ["The array is in swap", false],
        ["Integer increments are serialized by the memory bus on all CPUs", false]
      ],
      explain: "Eight consecutive 8-byte counters fit in one cache line. Every write invalidates that line in the other seven cores' caches, so the 'independent' counters contend exactly like one shared counter. Padding/aligning each to 64 bytes makes the threads truly independent — a routine 10x in this microbenchmark shape."
    },
    {
      q: "What actually happens on a syscall like read()?",
      options: [
        ["The CPU switches to kernel mode via a trap instruction, the kernel validates and performs the operation, then returns to user mode — a controlled, moderately cheap transition", true],
        ["A new kernel process is forked to handle the request", false],
        ["The call is compiled into direct hardware access from user space", false],
        ["A full context switch to another process always occurs", false]
      ],
      explain: "A syscall is a mode switch within the same thread, not a context switch to another process (though the thread may later block and yield the CPU). It costs tens to hundreds of nanoseconds plus cache effects — cheap enough to ignore mostly, expensive enough that hot loops batch them (writev, io_uring) and that vDSO exists for gettimeofday."
    },
    {
      q: "Why is fork() cheap even for a process using gigabytes of memory?",
      options: [
        ["Copy-on-write: parent and child share all pages read-only; a page is physically copied only when either side writes it", true],
        ["The kernel compresses the parent's memory before copying", false],
        ["fork() only copies the stack, never the heap", false],
        ["It isn't — fork always copies the full address space", false]
      ],
      explain: "fork duplicates page tables, marks both copies' pages read-only, and shares the physical frames. A write by either process faults, and the kernel copies just that page (COW). This is also why redis can snapshot via fork: the child sees a frozen view while the parent keeps serving, paying only for pages that change during the save."
    },
    {
      q: "A GC'd service shows periodic latency spikes aligned with garbage collections. Which change most directly reduces GC pressure?",
      options: [
        ["Reduce the allocation rate on hot paths — reuse buffers, avoid per-request temporary objects, keep object lifetimes short or clearly long", true],
        ["Add more OS threads so collections run more often", false],
        ["Move all objects to the heap explicitly", false],
        ["Disable virtual memory for the process", false]
      ],
      explain: "Generational collectors are efficient when objects die young and allocation is modest; GC cost scales with allocation rate and the volume of surviving objects. Cutting allocations (pooling, streaming instead of materializing, value types where available) attacks the cause. More threads don't reduce garbage, and the other options are not real levers."
    },
    {
      q: "Why does accessing an array sequentially run far faster than chasing a linked list of the same size, even though both are O(n)?",
      options: [
        ["Sequential access exploits cache lines and the hardware prefetcher — each miss loads 64 useful bytes and the next lines arrive early; pointer-chasing takes a cache miss per node with no predictable next address", true],
        ["Arrays are stored in registers instead of RAM", false],
        ["Linked lists require a syscall per node access", false],
        ["The compiler parallelizes array loops across cores automatically", false]
      ],
      explain: "Big-O hides the ~100x gap between L1 and RAM. An array walk streams through memory, amortizing one miss over a whole line while the prefetcher runs ahead; each list node is a dependent load at an unpredictable address — a full memory stall per element. This locality gap is why contiguous structures dominate real-world performance."
    },
    {
      type: "multi",
      q: "Which of the following are true about mutexes vs atomics?",
      options: [
        ["An uncontended mutex lock/unlock is cheap — roughly a CAS on the fast path", true],
        ["A contended mutex may park the thread in the kernel (futex), costing a context switch", true],
        ["Atomic operations like fetch_add work on single words and cannot protect a multi-field invariant by themselves", true],
        ["Atomics are always faster than mutexes regardless of contention", false],
        ["A mutex provides the acquire/release memory ordering that makes protected data safely visible", true]
      ],
      explain: "Modern mutexes spin briefly in user space and only trap to the kernel under contention; atomics avoid blocking but under heavy contention a CAS retry loop can burn more than a lock would, and they can't make two related fields consistent. Lock/unlock imply acquire/release ordering — that's why 'just use a mutex' is safe advice."
    },
    {
      type: "multi",
      q: "Which mechanisms are part of how virtual memory is used in practice?",
      options: [
        ["Demand paging: pages are loaded on first access rather than upfront", true],
        ["Copy-on-write sharing between parent and child after fork", true],
        ["Memory-mapped files (mmap) making file contents appear as memory", true],
        ["Shared libraries mapped once physically and into many processes' address spaces", true],
        ["Direct user-space access to any physical address for speed", false]
      ],
      explain: "The first four are the standard payoffs of the virtual memory abstraction: lazy loading, cheap fork, mmap I/O, and physical sharing of read-only code. Arbitrary physical access is precisely what virtual memory forbids — that isolation is the point."
    },
    {
      type: "order",
      q: "Order what happens when a running thread touches memory whose page is currently swapped out to disk:",
      steps: [
        "The CPU's address translation finds no valid mapping (TLB miss, then page-table walk)",
        "A page fault traps execution into the kernel",
        "The kernel identifies the page as valid-but-on-disk and schedules the disk read; the thread blocks",
        "The scheduler runs other threads while the I/O completes",
        "The kernel maps the loaded page and the faulting thread resumes at the same instruction"
      ],
      explain: "This is the major-fault path: translation fails, the trap hands control to the kernel, disk I/O forces a block-and-switch, and afterwards the instruction restarts as if nothing happened. The invisible restart is why paging is transparent — and the milliseconds of disk time are why major faults in a hot path destroy performance."
    }
  ],
  dist: [
    {
      q: "A service calls a payment API, and the request times out. What does the caller actually know?",
      options: [
        ["Nothing definite — the request may have failed before processing, been processed successfully, or still be in flight; the response was simply not seen in time", true],
        ["The payment was definitely not processed", false],
        ["The payment was processed but the network dropped the response", false],
        ["The remote service has crashed", false]
      ],
      explain: "A timeout is the absence of information, not evidence of failure: any of the three outcomes is possible. This ambiguity is the root problem of distributed systems — it's why blind retries need idempotency, why 'did the charge go through' requires an idempotency key the server deduplicates on, and why failure detection is always a suspicion."
    },
    {
      q: "What does the CAP theorem actually force you to choose, and when?",
      options: [
        ["Only during a network partition: either refuse/delay some requests (consistency) or answer with possibly-stale data (availability)", true],
        ["At all times: a system is permanently either CA, CP, or AP", false],
        ["Between latency and throughput on every request", false],
        ["Between durability and availability during high load", false]
      ],
      explain: "CAP's choice activates only when a partition splits the system; with the network healthy you can have both C and A. The everyday tradeoff is PACELC's else-branch: even without partitions, stronger consistency costs coordination latency. Mature systems expose the dial per operation (read/write concern levels), not one global letter pair."
    },
    {
      q: "In Raft, why can a committed log entry never be lost by a future leader election?",
      options: [
        ["Commit requires a majority to hold the entry, and election requires a majority of votes — the two majorities must overlap, and voters reject candidates whose logs are behind", true],
        ["The leader writes every entry to all nodes before committing", false],
        ["Entries are committed to stable external storage outside the cluster", false],
        ["Elections are only allowed when all nodes have identical logs", false]
      ],
      explain: "Any two majorities of the same cluster share at least one node, so some voter in the winning candidate's electorate holds every committed entry — and the election rule ('reject candidates with a log older than mine') ensures the winner's log is at least as complete as that voter's. Overlap plus the voting restriction is the entire safety argument."
    },
    {
      q: "With N=5 replicas, writes acknowledged by W=3 and reads querying R=3, why does a read always observe the latest acknowledged write?",
      options: [
        ["Because W + R > N, every read set overlaps every write set in at least one replica, and version numbers identify the newest value among the responses", true],
        ["Because 3 replicas is enough for the data to be durable", false],
        ["Because reads are routed to the same nodes that took the write", false],
        ["It doesn't — quorums only guarantee durability, not read freshness", false]
      ],
      explain: "3 + 3 > 5 forces a non-empty intersection between any write quorum and any read quorum, so at least one replica in the read set has the newest write; the client (or coordinator) picks the highest version among responses. Dial W and R down and you buy latency/availability at the price of possibly-stale reads — the tradeoff made explicit."
    },
    {
      q: "A message queue delivers at-least-once, and a consumer's handler charges customers $10 per message. After a consumer crash and redelivery, a customer is charged twice. The correct fix is:",
      options: [
        ["Make the handler idempotent: record the message/operation ID transactionally with the charge, and skip messages already processed", true],
        ["Switch the queue to at-most-once delivery so duplicates cannot happen", false],
        ["Reduce the redelivery timeout so retries come faster", false],
        ["Have the producer send each message only once", false]
      ],
      explain: "Duplicates are inherent to at-least-once delivery (the ack can be lost after processing succeeds). Exactly-once effects are built at the consumer: dedupe on a stable ID stored atomically with the side effect. At-most-once avoids duplicates by sometimes losing messages — usually worse for money — and the producer cannot control redelivery."
    },
    {
      q: "Why does two-phase commit (2PC) have a reputation for hurting availability?",
      options: [
        ["Participants that voted 'prepared' must hold locks and wait — potentially indefinitely — if the coordinator crashes before broadcasting the decision", true],
        ["It requires all messages to arrive in order", false],
        ["It cannot work with more than two participants", false],
        ["The prepare phase must be repeated for every row", false]
      ],
      explain: "Between 'prepared' and the coordinator's verdict, a participant can neither commit nor abort unilaterally — it is in doubt, holding locks that block other transactions. A crashed coordinator turns that into a stall measured in minutes. This blocking window, multiplied availability risk, is why sagas or single-database designs are preferred across service boundaries."
    },
    {
      q: "In a saga (e.g., book flight → charge card → reserve hotel), the hotel reservation fails. What happens?",
      options: [
        ["Compensating transactions run in reverse: refund the charge, cancel the flight — the earlier steps were already visible and are undone, not rolled back atomically", true],
        ["The database rolls back all three steps atomically as one transaction", false],
        ["The saga blocks until the hotel service recovers", false],
        ["The flight and charge remain — sagas do not handle failures", false]
      ],
      explain: "Sagas trade atomicity for availability: each step commits locally and is immediately visible, and failure triggers explicit compensations (refund, cancel) in reverse order. The design burden is business-level: intermediate states like 'charged, then refunded' happen and must be acceptable, and compensations themselves must be idempotent and retried."
    },
    {
      q: "Service A writes an order to its database and then publishes an OrderCreated event to a broker. Occasionally the DB commit succeeds but the publish fails, leaving downstream services unaware. The standard fix is:",
      options: [
        ["The outbox pattern: write the order and the event into the same local transaction (outbox table), and have a relay publish from the outbox afterwards", true],
        ["Publish the event first, then write the database", false],
        ["Wrap the DB write and the broker publish in a distributed 2PC transaction", false],
        ["Retry the publish in a catch block until it succeeds", false]
      ],
      explain: "Two systems can't be updated atomically without coordination — publishing first just inverts the failure (event without order), and retry-in-process dies with the process. The outbox makes the event part of the local ACID transaction; a relay (or CDC) then delivers it at-least-once, and consumers dedupe. This is the standard dual-write cure."
    },
    {
      q: "A leader holds a lease-based distributed lock, pauses for a long GC, and its lease expires; a new leader is elected. The old leader wakes and writes to shared storage. What prevents corruption?",
      options: [
        ["A fencing token: each lease grant carries a monotonically increasing number, and storage rejects writes bearing an older token than it has already seen", true],
        ["The old leader's clock tells it the lease expired, so it will not write", false],
        ["The lock service kills the old leader's process", false],
        ["Nothing — lease-based locks cannot be made safe", false]
      ],
      explain: "The zombie leader cannot be trusted to check its own lease — the pause happened between the check and the write. Safety must live at the resource: the storage system tracks the highest token seen and rejects stale ones. Kleppmann's Redlock critique made this famous; leases give liveness, fencing gives safety."
    },
    {
      q: "1,000 clients hit a service that briefly fails; all retry after exactly 1 second, knocking it over again in synchronized waves. What breaks the cycle?",
      options: [
        ["Exponential backoff with jitter: each client waits a randomized, growing delay, spreading retries thin enough for the service to recover", true],
        ["Retrying faster so clients get through before the queue builds", false],
        ["Removing the retry limit so every request eventually succeeds", false],
        ["Having all clients synchronize their clocks first", false]
      ],
      explain: "Fixed delays keep the herd synchronized — each wave re-creates the original spike. Randomizing within an exponentially growing window (full jitter: wait U(0, base·2^attempt)) decorrelates clients, turning waves into a trickle. Production stacks add retry budgets and circuit breakers so retries can't exceed a fraction of live traffic."
    },
    {
      q: "Two replicas accept writes concurrently during a partition; both increment a shared counter. With a CRDT G-counter, why is there no conflict at merge time?",
      options: [
        ["Each replica increments only its own slot in a per-replica vector, and merge takes the element-wise max — increments from both sides survive, and merge order doesn't matter", true],
        ["The CRDT rolls back the smaller of the two counters", false],
        ["Timestamps decide which increment wins", false],
        ["The counter blocks writes during partitions", false]
      ],
      explain: "CRDTs make merge a commutative, associative, idempotent function so replicas converge regardless of delivery order — a G-counter is a vector of per-replica counts whose value is the sum and whose merge is element-wise max. Contrast last-writer-wins, where a timestamp silently discards one side's update."
    },
    {
      q: "Your service fans out to a dependency that has started timing out on every call. Threads pile up waiting, and your own callers begin timing out too. Which pattern stops the cascade?",
      options: [
        ["A circuit breaker: after repeated failures, fail calls to the dependency immediately for a cooldown period, then probe with a trial request before closing again", true],
        ["Doubling your own timeout so more calls have time to complete", false],
        ["Adding more retry attempts per request", false],
        ["Increasing your thread pool size indefinitely", false]
      ],
      explain: "The cascade is caused by capacity held hostage: every incoming request burns a thread for the full timeout on a dependency that is clearly down. Failing fast returns errors in microseconds, sheds the load, and gives the dependency room to recover; half-open probes detect recovery. Longer timeouts and more retries feed the fire."
    },
    {
      type: "multi",
      q: "Which statements about consistency models are true?",
      options: [
        ["Linearizability: once a write completes, every subsequent read (anywhere) sees it", true],
        ["Eventual consistency: replicas converge if writes stop, but reads may meanwhile be stale or out of order", true],
        ["Causal consistency guarantees effects are never seen before their causes (a reply never precedes its post)", true],
        ["Eventual consistency guarantees convergence within a bounded, advertised time", false],
        ["Linearizable reads are typically free, since they need no coordination", false]
      ],
      explain: "Linearizability is the strong, real-time model and requires coordination (quorum/leader reads — not free). Causal sits between, ordering only cause-and-effect. Eventual promises convergence eventually, with no bound — 'eventual' is doing a lot of work in that name."
    },
    {
      type: "multi",
      q: "Which are genuine reasons a majority quorum (e.g., 3 of 5) is used for leader election and commits?",
      options: [
        ["Any two majorities overlap, so two leaders cannot be elected for the same term", true],
        ["A new leader's majority must include a node that has every committed entry", true],
        ["The minority side of a partition cannot elect a leader or commit writes — preventing split brain", true],
        ["Majorities make the cluster tolerate the failure of any minority of nodes while still making progress", true],
        ["A majority guarantees zero data loss even if all nodes' disks are destroyed", false]
      ],
      explain: "Overlap is the load-bearing property: it excludes dual leaders, preserves committed entries across elections, silences the partitioned minority, and lets N=5 survive 2 failures. It cannot protect against losing every copy — durability still requires the data to physically exist somewhere."
    },
    {
      type: "order",
      q: "Order the events in a Raft leader election after the leader crashes:",
      steps: [
        "Followers stop receiving heartbeats and an election timeout expires on one of them",
        "That follower increments the term and becomes a candidate, voting for itself",
        "It sends RequestVote to all nodes; nodes with logs no newer than the candidate's grant their vote (one vote per term)",
        "The candidate reaches a majority of votes and becomes leader",
        "The new leader sends heartbeats/AppendEntries, and any stale ex-leader that returns steps down on seeing the higher term"
      ],
      explain: "Timeout → candidacy → votes → majority → heartbeats is the full cycle; randomized timeouts make split votes rare, the up-to-date-log rule protects committed entries, and term numbers fence off a returning zombie leader."
    }
  ],
  net: [
    {
      q: "Why does TCP need a 3-way handshake (SYN, SYN-ACK, ACK) before data flows?",
      options: [
        ["Both sides must exchange and acknowledge initial sequence numbers so every byte can be ordered, acknowledged, and retransmitted reliably", true],
        ["To negotiate which encryption cipher to use", false],
        ["To let routers along the path reserve bandwidth", false],
        ["To verify the server's identity certificate", false]
      ],
      explain: "The handshake synchronizes the sequence-number state that all of TCP's reliability machinery hangs off — and confirms both directions of the path work. Encryption and identity are TLS's job, a layer above, and IP routers keep no per-connection state at all."
    },
    {
      q: "TCP guarantees in-order delivery to the application. What happens to segments 2..10 when segment 1 is lost in transit?",
      options: [
        ["The kernel buffers them and delivers nothing to the application until the retransmitted segment 1 arrives — transport-level head-of-line blocking", true],
        ["They are delivered immediately and segment 1 is delivered late, out of order", false],
        ["They are discarded and all ten segments are retransmitted", false],
        ["The connection resets", false]
      ],
      explain: "The byte stream abstraction requires filling the gap first, so received-but-undeliverable data waits in the receive buffer (SACK tells the sender only segment 1 is missing, so only it is retransmitted). This stall is exactly why HTTP/2's multiplexing over one TCP connection still suffers on lossy links, and what QUIC's independent streams fix."
    },
    {
      q: "What is the difference between TCP flow control and congestion control?",
      options: [
        ["Flow control protects the receiver (advertised window: 'my buffer has this much room'); congestion control protects the network (congestion window probed via slow start/AIMD)", true],
        ["They are two names for the same window", false],
        ["Flow control operates on ports, congestion control on IP addresses", false],
        ["Congestion control is optional and disabled on fast networks", false]
      ],
      explain: "Two independent throttles: the receiver states its buffer capacity outright, while network capacity must be discovered by probing — grow until loss/ECN signals congestion, then back off. The sender honors the minimum of the two windows. Effective throughput ≈ window/RTT, which is why long-fat pipes need window scaling."
    },
    {
      q: "A user types https://shop.example.com. In what order do the protocol steps happen before the first HTML byte arrives (cold cache, HTTP/2)?",
      options: [
        ["DNS resolution → TCP handshake → TLS handshake → HTTP request → response", true],
        ["TCP handshake → DNS resolution → HTTP request → TLS handshake → response", false],
        ["TLS handshake → DNS resolution → TCP handshake → HTTP request → response", false],
        ["DNS resolution → TLS handshake → TCP handshake → HTTP request → response", false]
      ],
      explain: "You can't connect without an IP (DNS first), can't encrypt without a transport (TCP before TLS), and can't request until the secure channel exists. On a 150ms RTT path that's roughly one RTT each for TCP and TLS 1.3 before the request even leaves — the arithmetic behind connection reuse, session resumption, CDNs, and QUIC's folding of transport+TLS into one round trip."
    },
    {
      q: "Why do DNS changes seem to 'propagate' slowly even though authoritative servers update instantly?",
      options: [
        ["Resolvers worldwide serve the old record from cache until its TTL expires — propagation is just cache expiry", true],
        ["The root servers must approve each change", false],
        ["DNS updates physically travel between servers over hours", false],
        ["Browsers refuse to re-resolve a domain more than once a day", false]
      ],
      explain: "Every resolver that fetched the record caches it for the TTL; until that clock runs out they answer from cache without asking again. Planning a migration means lowering the TTL in advance, switching, then raising it back. Nothing propagates outward — caches just expire inward."
    },
    {
      q: "How does TLS 1.3 achieve forward secrecy — meaning recorded traffic stays safe even if the server's private key later leaks?",
      options: [
        ["Session keys derive from an ephemeral Diffie-Hellman exchange generated fresh per connection; the server's long-term key only signs/authenticates and never encrypts the traffic keys", true],
        ["Each packet is encrypted with a brand-new certificate", false],
        ["The server rotates its certificate every session", false],
        ["Traffic keys are stored encrypted on the server's disk", false]
      ],
      explain: "The ECDHE shares exist only in memory for the connection's lifetime; the certificate's key merely proves identity by signing the handshake transcript. Compromising it later lets an attacker impersonate the server going forward, but the recorded ciphertext remains undecryptable — the ephemeral secrets are gone. TLS 1.3 removed the static-RSA mode that lacked this."
    },
    {
      q: "HTTP/2 multiplexes many requests over one TCP connection, yet on a lossy WiFi link a site can load slower over HTTP/2 than over HTTP/1.1 with six connections. Why?",
      options: [
        ["One lost packet stalls every multiplexed stream on the single TCP connection (transport HOL blocking), while six separate connections isolate the damage to one", true],
        ["HTTP/2's binary framing is slower to parse than text", false],
        ["Header compression corrupts packets on wireless links", false],
        ["HTTP/2 disables TCP retransmission", false]
      ],
      explain: "HTTP/2 fixed request-level HOL blocking but concentrated all streams onto one in-order bytestream — TCP holds back all later bytes until a lost segment is retransmitted, freezing every stream at once. With HTTP/1.1's parallel connections, a loss stalls only that connection. QUIC (HTTP/3) makes streams independent at the transport, fixing it properly."
    },
    {
      q: "What fundamental problem pushed HTTP/3 to build QUIC on UDP instead of improving TCP?",
      options: [
        ["Removing transport head-of-line blocking requires per-stream loss recovery, which can't be added to TCP's single ordered bytestream — and TCP is ossified in kernels and middleboxes; UDP lets the new transport ship in user space", true],
        ["UDP is inherently faster than TCP on all networks", false],
        ["TCP cannot carry encrypted traffic", false],
        ["UDP packets are prioritized by internet routers", false]
      ],
      explain: "QUIC reimplements reliability per-stream, integrates TLS 1.3 into a 1-RTT (or 0-RTT resumed) handshake, and adds connection migration across IP changes. Riding on UDP is pragmatic deployability: middleboxes pass it, and the protocol evolves in user space instead of waiting a decade for kernel and middlebox upgrades."
    },
    {
      q: "When would you choose an L4 load balancer over an L7 one?",
      options: [
        ["When you need raw connection-level throughput or non-HTTP protocols, and don't need path/header routing, retries, or TLS termination at the balancer", true],
        ["When you need to route /api/v2 to a different backend pool than /static", false],
        ["When you need sticky sessions based on a cookie", false],
        ["When backends speak plain HTTP and clients speak HTTPS", false]
      ],
      explain: "L4 forwards TCP/UDP flows by IP and port — protocol-blind, extremely fast, millions of connections. Path routing, cookie stickiness, and TLS offload all require reading HTTP, i.e., an L7 proxy that terminates the connection. Big deployments stack them: L4 at the edge spreading across a fleet of L7 proxies."
    },
    {
      q: "A page fans out to 100 backend calls in parallel; each backend answers within 10ms at p99 but occasionally takes 1s. Roughly how often does the page hit at least one slow call?",
      options: [
        ["About 63% of pages (1 − 0.99¹⁰⁰) — tail latency compounds under fan-out, so the page's latency is dominated by the worst straggler", true],
        ["1% — the same as a single backend", false],
        ["Effectively never, since the calls run in parallel", false],
        ["100% of pages", false]
      ],
      explain: "With 100 independent draws, the chance of avoiding the 1% tail everywhere is 0.99¹⁰⁰ ≈ 37%. This is 'The Tail at Scale': means are irrelevant under fan-out; p99s multiply into the common case. Countermeasures: hedged requests after a small delay, strict per-call deadlines, and trimming the fan-out itself."
    },
    {
      q: "Why does NAT break inbound connections to a machine on a home network, while outbound ones work fine?",
      options: [
        ["The NAT's translation table is created by outbound traffic; an unsolicited inbound packet matches no entry, so the router has no idea which private host should receive it", true],
        ["NAT blocks all TCP traffic by default as a firewall", false],
        ["Private IP addresses cannot appear inside packets", false],
        ["Inbound packets are too large for the home router's MTU", false]
      ],
      explain: "Outbound packets stamp a mapping (private IP:port ↔ public IP:port) that return traffic matches. Nothing maps an unsolicited inbound SYN, so it's dropped. Hence port forwarding, UPnP, and the hole-punching/STUN/TURN machinery every P2P and video-call app carries; IPv6's end-to-end addressing removes the need (firewall policy remains)."
    },
    {
      q: "gRPC is chosen over plain JSON/HTTP for internal service-to-service APIs mainly because:",
      options: [
        ["Protobuf contracts generate typed clients/servers with compact binary encoding, and HTTP/2 gives multiplexing plus first-class streaming RPCs", true],
        ["gRPC works without any network connection", false],
        ["JSON cannot represent nested objects", false],
        ["gRPC bypasses TCP for lower latency", false]
      ],
      explain: "The schema is the API: codegen eliminates hand-rolled serialization drift, binary framing cuts payload and parse cost, and bidirectional streams fit push and bulk use cases. The tradeoffs: browsers need a proxy (gRPC-Web), and payloads aren't human-readable — which is why public APIs often stay REST/JSON while the interior goes gRPC."
    },
    {
      type: "multi",
      q: "Which statements about TCP vs UDP are true?",
      options: [
        ["TCP provides ordered, reliable byte-stream delivery with retransmission", true],
        ["UDP preserves message boundaries and adds essentially just ports and a checksum on top of IP", true],
        ["QUIC builds reliability and streams on top of UDP in user space", true],
        ["UDP retransmits lost datagrams automatically after a timeout", false],
        ["TCP guarantees a minimum bandwidth for the connection", false]
      ],
      explain: "TCP turns best-effort packets into a reliable ordered stream; UDP deliberately adds almost nothing, which is exactly why protocols needing custom semantics (QUIC, DNS, games, media) build on it. Nobody guarantees bandwidth — congestion control shares whatever the path offers."
    },
    {
      type: "multi",
      q: "Which techniques exist primarily to reduce round trips or their cost on the web?",
      options: [
        ["TLS 1.3 cutting the handshake to 1 RTT (0-RTT on resumption)", true],
        ["CDNs terminating connections at an edge close to the user", true],
        ["HTTP keep-alive / connection reuse avoiding repeated TCP+TLS setup", true],
        ["QUIC combining transport and crypto setup into one handshake", true],
        ["Gzip compression of response bodies", false]
      ],
      explain: "Latency is round trips × RTT, so the wins come from fewer handshakes (TLS 1.3, QUIC, keep-alive) or shorter RTTs (edge termination). Compression shrinks bytes — it helps bandwidth-bound transfers, but doesn't remove round trips."
    },
    {
      type: "order",
      q: "Order the steps of a cold-cache DNS resolution for shop.example.com by a recursive resolver:",
      steps: [
        "The stub resolver on the client asks its configured recursive resolver",
        "The recursive resolver queries a root server, which refers it to the .com TLD servers",
        "The TLD server refers it to example.com's authoritative nameservers",
        "The authoritative server returns the A/AAAA record with its TTL",
        "The recursive resolver caches the record for the TTL and returns the address to the client"
      ],
      explain: "Root → TLD → authoritative is the delegation walk, done by the recursive resolver on the client's behalf; caching at every layer (browser, OS, resolver) means the full walk is rare — and the TTL set at the authoritative server controls how long everyone else may keep answering from cache."
    }
  ],
  infra: [
    {
      q: "Why does a container start in milliseconds while a VM takes much longer?",
      options: [
        ["A container is just a process on the host kernel, isolated by namespaces and cgroups — nothing boots; a VM must initialize virtual hardware and boot a full guest kernel", true],
        ["Container images are always smaller than VM disks", false],
        ["Containers skip filesystem initialization", false],
        ["VMs are throttled by the hypervisor on startup", false]
      ],
      explain: "There is no guest OS in a container — the 'boot' is fork/exec plus namespace setup. That same fact defines the security tradeoff: all containers share the host kernel, so a kernel exploit crosses container boundaries, which is why hostile multi-tenant platforms interpose VMs or gVisor/Firecracker."
    },
    {
      q: "In Kubernetes, you delete a pod managed by a Deployment with replicas: 3. What happens?",
      options: [
        ["A controller notices observed state (2 pods) no longer matches desired state (3) and creates a replacement — the reconciliation loop at work", true],
        ["The Deployment now permanently runs 2 replicas", false],
        ["The cluster restores the exact same pod with the same name and IP", false],
        ["Nothing until an administrator reapplies the manifest", false]
      ],
      explain: "Kubernetes is a desired-state system: etcd stores '3 replicas', controllers continuously reconcile reality toward it, so deletion just triggers a replacement (new name, new IP — pods are cattle). This is also why hand-editing live state is futile: the loop reverts you. Change the declaration instead."
    },
    {
      q: "What is the difference between a liveness probe and a readiness probe, and why does confusing them hurt?",
      options: [
        ["Liveness failure restarts the container; readiness failure only removes the pod from Service endpoints — using liveness for 'warming up' causes restart loops, and missing readiness sends traffic to pods that can't serve", true],
        ["They are synonyms; Kubernetes requires both for redundancy", false],
        ["Liveness checks the network, readiness checks the disk", false],
        ["Readiness failure deletes the pod permanently", false]
      ],
      explain: "Liveness answers 'is this process beyond saving?' (hung → kill and restart); readiness answers 'should it receive traffic right now?' (still loading, draining, dependency down → no). A slow-starting app with an aggressive liveness probe gets killed before it ever becomes ready — the classic CrashLoopBackOff self-inflicted wound."
    },
    {
      q: "A pod has memory request 512Mi and limit 1Gi. What do these two numbers control?",
      options: [
        ["The scheduler places the pod counting 512Mi against node capacity; if actual usage exceeds 1Gi the container is OOM-killed", true],
        ["The pod is guaranteed exactly 1Gi at all times", false],
        ["Kubernetes compresses the pod's memory above 512Mi", false],
        ["The numbers only affect billing reports", false]
      ],
      explain: "Requests are the scheduling reservation (and the basis of QoS class); limits are the enforcement cap — exceed a memory limit and the OOM killer terminates the container (CPU, by contrast, is throttled, not killed). The request-to-limit gap is deliberate overcommit: efficient, but a node full of bursting neighbors can evict you."
    },
    {
      q: "Why deploy by image digest (or immutable version tag) instead of :latest?",
      options: [
        ["Tags are mutable pointers — :latest can silently change between pulls, so nodes can run different code and rollbacks become guesswork; a digest pins the exact bytes", true],
        [":latest images are rebuilt on every pull, which is slow", false],
        ["Registries charge more for tagged pulls", false],
        ["Digests download faster than tags", false]
      ],
      explain: "Reproducibility is the point: the same manifest must mean the same software next week, on every node, and in the rollback path. A mutable tag breaks all three quietly (two nodes scale up days apart and run different builds). CI should stamp immutable versions and manifests should reference them — or the digest itself."
    },
    {
      q: "During a rolling update, versions v1 and v2 of a service run side by side for several minutes. What does this force on your database schema changes?",
      options: [
        ["Backward compatibility via expand-contract: add the new column/table first, deploy code that handles both, migrate data, and only later remove the old schema — never a breaking change in one step", true],
        ["Nothing — the database is locked during deployments", false],
        ["Schema changes must be applied simultaneously with the code deploy in one transaction", false],
        ["Rolling updates cannot be used with databases", false]
      ],
      explain: "While both versions serve traffic, v1 still reads/writes the old shape — dropping or renaming a column mid-rollout breaks it instantly (and breaks rollback after). Expand-contract sequences every migration into compatible steps: expand schema, dual-read/write, backfill, cut over, contract later. This applies equally to API contracts between services."
    },
    {
      q: "What makes a canary release safer than deploying the new version to the whole fleet?",
      options: [
        ["Only a small traffic slice sees the new version while its error and latency metrics are compared against the baseline — a bad release is caught with 5% blast radius and rolled back", true],
        ["The canary version runs with extra debug logging enabled", false],
        ["Canary instances run on isolated hardware", false],
        ["It is faster than a normal deployment", false]
      ],
      explain: "A canary is a live experiment with real traffic and a small denominator: route 1–5%, watch RED metrics per version for a soak period, ramp on green, revert on red. Its prerequisites are the real work — per-version metrics, automated judgment, and rollback wired to fire without a human watching dashboards."
    },
    {
      q: "Your SLO is 99.9% successful requests per 30 days (~43 minutes of error budget). The budget is exhausted mid-month. What does SRE practice say happens next?",
      options: [
        ["Feature launches pause and engineering effort shifts to reliability work until the budget recovers — the pre-agreed policy makes the tradeoff mechanical instead of political", true],
        ["The SLO is lowered so the budget fits", false],
        ["Nothing — error budgets are informational only", false],
        ["The on-call engineer is replaced", false]
      ],
      explain: "The error budget's entire value is that consequences were negotiated in advance: while budget remains, ship fast and don't gold-plate; when it's spent, reliability work wins priority automatically. Alerting follows the same logic — page on burn rate ('budget gone in 6 hours at this pace'), ticket on slow leaks."
    },
    {
      q: "Why should alerts page on symptoms (SLO burn rate, user-visible error rate) rather than causes (CPU 80%, disk 70% full)?",
      options: [
        ["Cause-based alerts fire constantly without user impact and train responders to ignore pages; symptom alerts fire exactly when users are hurt, and causes are investigated from dashboards afterwards", true],
        ["Cause metrics are too expensive to collect continuously", false],
        ["Symptoms are easier to auto-remediate", false],
        ["Pager systems cannot evaluate resource thresholds", false]
      ],
      explain: "High CPU with healthy latency is Tuesday, not an incident — but a page either way erodes trust until real pages get slow responses. Alerting on what users experience (availability, latency against SLO) keeps the pager honest; resource metrics remain as diagnostic context and capacity-planning tickets."
    },
    {
      q: "A hot cache key with a 60s TTL expires under heavy traffic, and 5,000 concurrent requests miss simultaneously and hammer the database — recurring every minute. What is this, and a standard fix?",
      options: [
        ["A cache stampede (thundering herd) — fix with per-key request coalescing (one loader, others wait), stale-while-revalidate, or jittered TTLs", true],
        ["A cache poisoning attack — rotate the cache keys", false],
        ["Normal behavior that only a bigger database can absorb", false],
        ["False sharing in the cache server's memory", false]
      ],
      explain: "Synchronized expiry converts one hot key into a periodic database spike. Coalescing collapses the 5,000 misses into one backend fetch; serving slightly-stale data while one request refreshes removes the cliff entirely; TTL jitter desynchronizes many keys expiring together. Capacity-plan for the miss path — the cache hides the true load until it doesn't."
    },
    {
      q: "When does a message queue between two services genuinely improve the architecture?",
      options: [
        ["When work is asynchronous by nature: the producer must absorb bursts, tolerate consumer downtime, and let consumers scale on backlog — accepting eventual consistency and duplicate-tolerant consumers", true],
        ["Whenever two services communicate — queues are always better than HTTP", false],
        ["When the caller needs the result within the same request", false],
        ["When messages must be delivered exactly once with zero added latency", false]
      ],
      explain: "Queues buy burst absorption, retry with DLQs, and independent scaling — paid for with latency, eventual consistency, and at-least-once semantics (idempotent consumers required). A synchronous request that needs the answer now gains nothing but complexity. Monitor queue age, not just depth: depth 10,000 might be fine; age 20 minutes is a fire."
    },
    {
      q: "Why is infrastructure-as-code (Terraform, etc.) preferred over configuring cloud resources through the console?",
      options: [
        ["The infrastructure becomes reviewable, versioned, and reproducible: plan shows the diff before apply, environments stay consistent, and disaster recovery is 'apply the code' instead of archaeology", true],
        ["IaC runs infrastructure changes faster than the cloud console", false],
        ["Cloud providers charge less for API-created resources", false],
        ["IaC removes the need for access controls", false]
      ],
      explain: "Click-ops produces snowflakes: undocumented, unrepeatable, and divergent across environments. Code + state gives diffs in review, git history as an audit log, identical staging/prod from shared modules, and drift detection when reality wanders from the declaration. The plan-before-apply step is the safety net consoles never had."
    },
    {
      type: "multi",
      q: "Which are among the 'three pillars' of observability, as usually described?",
      options: [
        ["Structured logs — searchable records of discrete events", true],
        ["Metrics — cheap numeric time series you can aggregate and alert on", true],
        ["Distributed traces — one request's timed path across services", true],
        ["Backups — periodic snapshots of system state", false],
        ["Feature flags — runtime toggles for behavior", false]
      ],
      explain: "Logs, metrics, traces — joined by correlation IDs so you can pivot from an SLO alert (metrics) to the slow hop (trace) to the error detail (logs). Backups are disaster recovery and flags are release engineering; both essential, neither observability."
    },
    {
      type: "multi",
      q: "Which practices reduce the risk of a bad deploy reaching all users?",
      options: [
        ["Canary releases judged on per-version error/latency metrics", true],
        ["Feature flags that ship code dark and enable it gradually (and kill it instantly)", true],
        ["Blue-green deployment with the old environment kept warm for instant rollback", true],
        ["Automated rollback triggered by SLO burn during rollout", true],
        ["Deploying everything at once during the lowest-traffic hour", false]
      ],
      explain: "The first four all shrink blast radius or shorten time-to-revert — the two levers that matter. Big-bang at 3 a.m. shrinks neither: 100% of (fewer) users still get the bug, detection is slower with less traffic, and the responders are asleep."
    },
    {
      type: "order",
      q: "Order the stages of a healthy CI/CD path from commit to full production:",
      steps: [
        "Push triggers CI: build the artifact and run unit/integration tests",
        "Publish the immutably versioned image to the registry",
        "Deploy automatically to a staging environment and run smoke/e2e checks",
        "Canary: route a small slice of production traffic to the new version and watch metrics",
        "Ramp to 100%, keeping rollback one action away"
      ],
      explain: "Each gate catches what the previous one can't: tests catch logic bugs, staging catches integration and config drift, the canary catches what only real production traffic reveals, and the ramp bounds the damage of anything that slipped through. The artifact is built once and promoted unchanged — never rebuilt per environment."
    }
  ]
};
