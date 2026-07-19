(() => {
  "use strict";

  const quizzes = {
    rtos: [
      {
        q: "A high-priority control task becomes Ready while a low-priority logging task is running. In a fixed-priority preemptive RTOS, what normally happens?",
        options: [
          "The logging task keeps the CPU until its time slice ends",
          "The control task preempts the logging task",
          "Both tasks execute simultaneously on one CPU core",
          "The idle task decides which task should run"
        ],
        answer: 1,
        explain: "The highest-priority Ready task runs. Preemption bounds the delay between an event making the control task Ready and that task executing; long interrupt-disabled regions and higher-priority work still add latency."
      },
      {
        q: "A low-priority task holds a mutex, a high-priority task waits for it, and medium-priority work keeps running. What mechanism addresses this priority inversion?",
        options: [
          "Round-robin time slicing",
          "Priority inheritance on the mutex owner",
          "Disabling the watchdog",
          "Increasing the system tick rate"
        ],
        answer: 1,
        explain: "Priority inheritance temporarily raises the mutex owner's priority so it can finish the critical section and release the resource. It limits unbounded inversion; it does not make oversized critical sections harmless."
      },
      {
        q: "What is the preferred interrupt-service-routine pattern when a sensor sample needs substantial processing?",
        options: [
          "Process the complete sample and write it to flash inside the ISR",
          "Take a blocking mutex and wait for the processing task",
          "Acknowledge the device, capture minimal state, and wake or notify a task",
          "Disable all other interrupts until processing completes"
        ],
        answer: 2,
        explain: "Keep the ISR bounded: clear the source, move or record the minimum data, then notify a task using an ISR-safe primitive. The task performs work that may block, allocate, or take significant time."
      },
      {
        q: "Which watchdog design gives the strongest evidence that the system is healthy?",
        options: [
          "Kick the watchdog from an unconditional periodic timer ISR",
          "Kick it only after all critical tasks have reported progress within their deadlines",
          "Kick it whenever any interrupt occurs",
          "Disable it during normal operation"
        ],
        answer: 1,
        explain: "A supervisor should feed the hardware watchdog only after checking independent liveness signals from critical tasks. An unconditional timer can keep feeding the watchdog while the application is deadlocked."
      },
      {
        q: "Why is bounded or static memory allocation common in hard real-time paths?",
        options: [
          "It makes all data immutable",
          "It avoids unbounded allocator latency and fragmentation surprises",
          "It prevents interrupts from occurring",
          "It guarantees zero-copy IPC"
        ],
        answer: 1,
        explain: "Real-time analysis needs bounded execution time. Preallocated pools, fixed-size queues, and static task stacks remove allocator contention and fragmentation from deadline-sensitive paths."
      }
    ],
    boot: [
      {
        q: "What is the most important property of Boot ROM in a secure-boot chain?",
        options: [
          "It is updated on every normal boot",
          "It provides the immutable first code and root-of-trust verification step",
          "It mounts the final root filesystem",
          "It loads user applications"
        ],
        answer: 1,
        explain: "Boot ROM is normally fixed in silicon. It establishes the first trusted step, often validating a first-stage loader with a key hash or public key anchored in immutable or one-time-programmable storage."
      },
      {
        q: "What does Secure Boot primarily establish?",
        options: [
          "Firmware confidentiality",
          "Authenticity and integrity of code before execution",
          "Faster boot time",
          "Automatic rollback to any older image"
        ],
        answer: 1,
        explain: "Signature verification establishes that an authorized signer produced the image and that it was not modified. Encryption is a separate confidentiality control, and anti-rollback needs version counters or policy."
      },
      {
        q: "On a typical embedded Linux platform, why is a device tree blob passed to the kernel?",
        options: [
          "To contain all Linux device drivers",
          "To describe non-discoverable hardware and resources so drivers can match and probe",
          "To replace the kernel command line only",
          "To store the user database"
        ],
        answer: 1,
        explain: "The DTB describes CPUs, memory, buses, addresses, clocks, resets, interrupts, IOMMU links, and devices that firmware or buses cannot enumerate. Compatible strings help the kernel bind drivers."
      },
      {
        q: "Which statement best compares UEFI and U-Boot?",
        options: [
          "UEFI is an operating system; U-Boot is a device driver",
          "They are alternative or combinable firmware environments that can select and launch an OS loader or kernel",
          "U-Boot can only run on x86 and UEFI only on ARM",
          "Neither can pass a device tree to Linux"
        ],
        answer: 1,
        explain: "UEFI defines standardized firmware services and a boot manager. U-Boot is common in embedded systems and can directly boot Linux or implement enough UEFI services to launch an EFI application. Platform designs may combine stages."
      },
      {
        q: "After the bootloader transfers control to Linux, which event normally occurs before ordinary services start?",
        options: [
          "The NPU runs user inference immediately",
          "The kernel initializes memory, interrupts and drivers, mounts or prepares the root filesystem, then starts PID 1",
          "Boot ROM verifies every user process",
          "UEFI remains responsible for scheduling Linux tasks"
        ],
        answer: 1,
        explain: "Linux performs architecture and subsystem initialization, probes drivers, prepares initramfs/rootfs, and finally invokes the first userspace process. Driver probe ordering can be deferred when dependencies are not ready."
      }
    ],
    startup: [
      {
        q: "For a discrete PCIe NPU, what must happen before the Linux NPU driver's probe callback can bind normally?",
        options: [
          "A model must already be loaded",
          "PCIe link training and bus enumeration must identify the device",
          "The NPU must mount the host root filesystem",
          "The RTOS must disable interrupts"
        ],
        answer: 1,
        explain: "Firmware and the OS enumerate the PCIe fabric, assign resources such as BARs, and expose vendor/device identifiers. The PCI core can then match those identifiers to a registered driver."
      },
      {
        q: "How is an integrated SoC NPU commonly discovered when it is not on an enumerable bus?",
        options: [
          "By scanning every physical address",
          "Through firmware description such as device tree or ACPI",
          "By waiting for a userspace model file",
          "Through DNS"
        ],
        answer: 1,
        explain: "A platform device is described by firmware tables, including register ranges, interrupts, clocks, resets, reserved memory and IOMMU relationships. The kernel matches the description to a platform driver."
      },
      {
        q: "Why should the host driver perform an ABI or capability handshake after starting NPU firmware?",
        options: [
          "To determine whether host runtime and firmware agree on queues, commands and supported features",
          "To increase PCIe lane width",
          "To bypass secure boot",
          "To replace DMA with programmed I/O"
        ],
        answer: 0,
        explain: "Version and capability negotiation prevents silent corruption when command layouts, tensor formats, queue counts, address widths, or recovery protocols differ between host software and device firmware."
      },
      {
        q: "What is the Linux firmware-loader API's role in a typical device startup?",
        options: [
          "It schedules NPU inference jobs",
          "It locates a firmware image and provides its bytes to the driver, which transfers them to the device",
          "It automatically verifies every vendor-specific signature format",
          "It creates PCIe hardware"
        ],
        answer: 1,
        explain: "request_firmware() and related APIs retrieve firmware. The device driver remains responsible for device-specific validation policy, copying or DMA transfer, reset sequencing, and starting the processor."
      },
      {
        q: "The NPU is visible on PCIe, but firmware never reports Ready. Which boundary should be investigated first?",
        options: [
          "DNS configuration",
          "Reset/clock/power sequencing, firmware transfer, boot address and mailbox/interrupt signaling",
          "The model's classification labels",
          "The host shell prompt"
        ],
        answer: 1,
        explain: "Enumeration proves the link and configuration-space path, not that the internal processor booted. Trace reset release, clocks, firmware placement, entry point, boot-status registers, mailbox messages and interrupt routing."
      }
    ],
    datapath: [
      {
        q: "What does a PCI BAR normally provide to an NPU driver?",
        options: [
          "A DNS address",
          "A discoverable register or device-memory aperture that the driver can map for MMIO",
          "A real-time task priority",
          "A signed Linux kernel"
        ],
        answer: 1,
        explain: "PCI configuration space describes Base Address Registers. After the PCI core assigns resources, the driver maps the aperture and accesses control/status registers or device memory with the correct MMIO helpers."
      },
      {
        q: "Why must a Linux driver use the DMA mapping API rather than pass an ordinary CPU virtual pointer to the NPU?",
        options: [
          "The API compresses tensor data",
          "The device needs a DMA/bus address and the API establishes any required IOMMU and cache-coherency handling",
          "Virtual pointers are always 32-bit",
          "The API disables all interrupts"
        ],
        answer: 1,
        explain: "CPU virtual, physical and device-visible DMA addresses are different domains. dma_map_* or coherent allocation yields a device address and applies platform-specific IOMMU and cache maintenance rules."
      },
      {
        q: "In a shared submission ring, why is a write memory barrier commonly placed before updating the producer doorbell?",
        options: [
          "To ensure descriptor contents are visible before the device observes the new producer index",
          "To encrypt the descriptor",
          "To force a context switch",
          "To allocate an interrupt vector"
        ],
        answer: 0,
        explain: "CPUs may reorder memory operations. The descriptor must be fully published before the MMIO doorbell or shared producer index tells the NPU that work is ready. The exact primitive depends on the coherency model."
      },
      {
        q: "What is a good completion-interrupt design for a high-throughput NPU?",
        options: [
          "Do all tensor post-processing in hard interrupt context",
          "Acknowledge/mask as needed, record completion state, then defer heavier work; use batching or polling when load warrants it",
          "Reset the NPU after every completion",
          "Never use queues"
        ],
        answer: 1,
        explain: "The top half should be bounded. Threaded interrupts, tasklets/workqueues, or a polling budget can drain completions outside hard-IRQ context. Coalescing reduces interrupt rate but adds latency."
      },
      {
        q: "An IOMMU reports a translation fault for an NPU DMA read. What is the most direct interpretation?",
        options: [
          "The model contains an unsupported operator",
          "The device issued an address that is unmapped or lacks the requested permission in its I/O address space",
          "The RTOS scheduler missed a deadline",
          "Secure Boot rejected U-Boot"
        ],
        answer: 1,
        explain: "Check the IOVA, mapping lifetime, direction/permissions, device attachment to the correct IOMMU domain, scatter-gather construction and whether a buffer was unmapped before the NPU finished."
      }
    ],
    endtoend: [
      {
        q: "Which order best represents the first useful inference on a cold host + NPU boot?",
        options: [
          "Model load → Boot ROM → driver → kernel → inference",
          "Boot ROM → trusted loader → host kernel → device discovery/driver → NPU firmware → queues and DMA → runtime/model → inference",
          "NPU firmware → DNS → Boot ROM → inference",
          "Driver → secure boot → UEFI → model load"
        ],
        answer: 1,
        explain: "Each stage creates an invariant required by the next: trusted host execution, an initialized OS, an owned device, running compatible NPU firmware, safe transport, then userspace runtime and model state."
      },
      {
        q: "Host Secure Boot succeeded. Does that automatically prove the NPU firmware is authorized?",
        options: [
          "Always",
          "Only if the chain of trust explicitly authenticates the NPU firmware through a trusted host or device verification step",
          "Only for PCIe devices",
          "Yes, because DMA provides authentication"
        ],
        answer: 1,
        explain: "The accelerator firmware is another executable security boundary. Its image must be covered by an authenticated manifest, verified by trusted host software, or verified by the NPU's own immutable boot chain."
      },
      {
        q: "Why is the IOMMU normally configured before untrusted userspace workloads can submit NPU commands?",
        options: [
          "To limit device DMA to explicitly mapped buffers and isolate processes or guests",
          "To make the NPU clock faster",
          "To choose an RTOS task priority",
          "To parse the model graph"
        ],
        answer: 0,
        explain: "An IOMMU constrains the addresses the device may access. It is a central containment boundary when command streams or buffer selections can be influenced by different processes, containers or virtual machines."
      },
      {
        q: "What should a production recovery path do after an NPU firmware watchdog expires?",
        options: [
          "Continue submitting work to the same queues",
          "Stop submissions, capture diagnostics, quiesce DMA, reset/reload firmware, rebuild queues, and fail or replay work according to policy",
          "Reboot only the host userspace shell",
          "Ignore the event if PCIe is still enumerated"
        ],
        answer: 1,
        explain: "Recovery is a state-machine transition. Prevent new DMA, preserve useful crash data, reset safely, re-establish the firmware ABI and transport, then notify clients which requests were lost or retried."
      },
      {
        q: "What is the main discovery difference between an SoC-integrated NPU and a discrete PCIe NPU?",
        options: [
          "Integrated devices are commonly described by firmware tables; PCIe devices are dynamically enumerated and identified through configuration space",
          "Only integrated NPUs use drivers",
          "Only PCIe NPUs use interrupts",
          "Integrated NPUs cannot use an IOMMU"
        ],
        answer: 0,
        explain: "Both still need drivers, resources, DMA and interrupts. The discovery and resource-description path differs: platform firmware descriptions for integrated IP versus PCIe link training, configuration-space enumeration and BAR assignment for discrete devices."
      }
    ]
  };

  function createQuestion(question, index, quizId, onAnswered) {
    const card = document.createElement("article");
    card.className = "quiz-card";

    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}. ${question.q}`;
    card.appendChild(heading);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "quiz-options";
    fieldset.setAttribute("aria-label", `Question ${index + 1} answers`);

    question.options.forEach((option, optionIndex) => {
      const label = document.createElement("label");
      label.className = "quiz-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `${quizId}-q${index}`;
      radio.value = String(optionIndex);

      const text = document.createElement("span");
      text.textContent = option;
      label.append(radio, text);
      fieldset.appendChild(label);
    });
    card.appendChild(fieldset);

    const check = document.createElement("button");
    check.type = "button";
    check.className = "quiz-check";
    check.textContent = "Check answer";
    check.disabled = true;
    card.appendChild(check);

    const feedback = document.createElement("div");
    feedback.className = "quiz-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    card.appendChild(feedback);

    fieldset.addEventListener("change", () => {
      check.disabled = false;
    });

    check.addEventListener("click", () => {
      const selected = fieldset.querySelector("input:checked");
      if (!selected) return;

      const selectedIndex = Number(selected.value);
      const correct = selectedIndex === question.answer;
      card.classList.add(correct ? "is-correct" : "is-incorrect");
      feedback.classList.add("show");
      if (!correct) feedback.classList.add("bad");

      const verdict = document.createElement("strong");
      verdict.textContent = correct
        ? "Correct."
        : `Not quite. Correct answer: ${question.options[question.answer]}`;
      const explanation = document.createElement("p");
      explanation.textContent = question.explain;
      feedback.replaceChildren(verdict, explanation);

      fieldset.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });
      check.disabled = true;
      check.textContent = "Answered";
      onAnswered(correct);
    }, { once: true });

    return card;
  }

  function initializeQuiz(shell) {
    const quizId = shell.dataset.quiz;
    const questions = quizzes[quizId];
    if (!questions) return;

    const score = document.createElement("p");
    score.className = "quiz-score";
    score.setAttribute("aria-live", "polite");

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "quiz-reset";
    reset.textContent = "Reset quiz";

    const toolbar = document.createElement("div");
    toolbar.className = "quiz-toolbar";
    toolbar.append(score, reset);

    const list = document.createElement("div");
    list.className = "quiz-list";
    shell.replaceChildren(toolbar, list);

    let answered = 0;
    let correct = 0;

    function updateScore() {
      score.textContent = `Score: ${correct}/${answered} answered · ${questions.length} total`;
    }

    function render() {
      answered = 0;
      correct = 0;
      list.replaceChildren();
      questions.forEach((question, index) => {
        list.appendChild(createQuestion(question, index, quizId, (wasCorrect) => {
          answered += 1;
          if (wasCorrect) correct += 1;
          updateScore();
        }));
      });
      updateScore();
    }

    reset.addEventListener("click", render);
    render();
  }

  document.querySelectorAll("[data-quiz]").forEach(initializeQuiz);
})();
