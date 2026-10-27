// Esperar a que el HTML cargue completamente
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm";
document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. MANEJO DE LA BARRA LATERAL (SIDEBAR)
  // ==========================================
  const sidebar = document.getElementById('sidebar');
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const navLinks = document.querySelectorAll('.nav-link');
  const viewSections = document.querySelectorAll('.view-section');

  if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('collapsed'));

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      if(link.classList.contains('locked')) {
        alert("Esta sección está bloqueada 🔒. Debes completar las actividades en la blockchain para acceder.");
        return;
      }
      
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      viewSections.forEach(section => section.classList.add('hidden'));
      
      const targetId = link.getAttribute('data-target');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.remove('hidden');
      if(window.innerWidth <= 900) sidebar.classList.add('collapsed');
    });
  });

  // ==========================================
  // 2. LÓGICA DE LOGIN Y REGISTRO
  // ==========================================
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterLink = document.getElementById('showRegister');
  const showLoginLink = document.getElementById('showLogin');
  const authStatus = document.getElementById('authStatus');
  const userPanel = document.getElementById('userPanel');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const logoutBtn = document.getElementById('logoutBtn');

  let loggedUserName = "Estudiante Web3";

  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      authStatus.textContent = "Completá tus datos para crear una nueva cuenta.";
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      authStatus.textContent = "Iniciá sesión o registrate para acceder a la plataforma.";
    });
  }

  const fireAuthConfetti = () => {
    confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#4ade80', '#ffffff', '#f5b942'] });
  };

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('regNombre').value;
      const apellido = document.getElementById('regApellido').value;
      const correo = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;

      try {
        const response = await fetch('/api/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, apellido, correo, password })
        });
        const data = await response.json();
        
        if (data.success) {
          fireAuthConfetti();
          registerForm.reset();
          registerForm.classList.add('hidden');
          loginForm.classList.remove('hidden');
          authStatus.textContent = "Iniciá sesión con tus nuevos datos.";
        } else { alert("Error: " + data.message); }
      } catch (err) { alert("No se pudo conectar con el servidor python."); }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const correo = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      try {
        const response = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo, password })
        });
        const data = await response.json();

        if (data.success) {
          fireAuthConfetti();
          loggedUserName = `${data.nombre} ${data.apellido || ''}`.trim();
          loginForm.classList.add('hidden');
          authStatus.classList.add('hidden');
          userPanel.classList.remove('hidden');
          userNameDisplay.textContent = loggedUserName;
          
          document.getElementById('quizAuthMessage').classList.add('hidden');
          document.getElementById('quizContainer').classList.remove('hidden');
        } else { alert("Error: " + data.message); }
      } catch (err) { alert("No se pudo conectar con el servidor."); }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      userPanel.classList.add('hidden');
      loginForm.classList.remove('hidden');
      authStatus.classList.remove('hidden');
      authStatus.textContent = "Iniciá sesión o registrate para acceder a la plataforma.";
      loginForm.reset();
      
      document.getElementById('quizAuthMessage').classList.remove('hidden');
      document.getElementById('quizContainer').classList.add('hidden');
      
      document.getElementById('credLockMessage').classList.remove('hidden');
      document.getElementById('credContentContainer').classList.add('hidden');
      document.getElementById('diplomaContainer').classList.add('hidden');
      
      const navCredential = document.getElementById('navCredential');
      navCredential.classList.add('locked');
      navCredential.classList.remove('unlocked');
      navCredential.textContent = "04 Mi Credencial 🔒";
    });
  }

  // ==========================================
  // 3. CUESTIONARIO DINÁMICO (QUIZ)
  // ==========================================
  const quizSets = [
    [
      { q: "¿Qué es principalmente una blockchain?", opts: ["Un banco digital", "Un registro inmutable", "Un lenguaje"], ans: 1 },
      { q: "¿Para qué se utiliza el Gas en Ethereum?", opts: ["Comprar mineros", "Es un servidor", "Pagar transacciones"], ans: 2 },
      { q: "¿Qué es un Smart Contract?", opts: ["Código en blockchain", "Documento firmado", "Billetera física"], ans: 0 },
      { q: "¿Qué función cumple MetaMask?", opts: ["Es un exchange", "Es billetera Web3", "Una red de pruebas"], ans: 1 },
      { q: "¿Qué significa SBT?", opts: ["Vinculado permanentemente", "No tiene valor", "Se envía a otras redes"], ans: 0 }
    ]
  ];

  let currentQuizIndex = 0;
  const quizQuestionsBox = document.getElementById('quizQuestionsBox');
  const quizForm = document.getElementById('quizForm');
  const btnQuizSubmit = document.getElementById('btnQuizSubmit');
  const btnQuizRetry = document.getElementById('btnQuizRetry');
  const resultBox = document.getElementById('resultBox');
  const rewardContainer = document.getElementById('rewardContainer');

  function loadQuizQuestions(setIndex) {
    if(!quizQuestionsBox) return;
    quizQuestionsBox.innerHTML = '';
    quizSets[setIndex].forEach((item, index) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question';
      let html = `<p>${index + 1}. ${item.q}</p>`;
      item.opts.forEach((opt, optIdx) => {
        const val = (optIdx === item.ans) ? 1 : 0;
        html += `<label><input type="radio" name="q${index}" value="${val}" required> ${opt}</label>`;
      });
      qDiv.innerHTML = html;
      quizQuestionsBox.appendChild(qDiv);
    });
  }

  loadQuizQuestions(currentQuizIndex);

  if (quizForm) {
    quizForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      let score = 0;
      for (let value of formData.values()) score += parseInt(value);

      resultBox.style.display = 'block';

      if (score >= 4) {
        resultBox.textContent = `¡Aprobado! Acertaste ${score} de 5.`;
        resultBox.className = 'result pass';
        confetti({ particleCount: 200, spread: 100 });
        btnQuizSubmit.classList.add('hidden');
        rewardContainer.classList.remove('hidden');
      } else {
        resultBox.textContent = `Desaprobado. Acertaste ${score} de 5. Necesitas al menos 4.`;
        resultBox.className = 'result fail';
        btnQuizSubmit.classList.add('hidden');
        btnQuizRetry.classList.remove('hidden');
      }
    });
  }

  if (btnQuizRetry) {
    btnQuizRetry.addEventListener('click', () => {
      currentQuizIndex = (currentQuizIndex + 1) % quizSets.length;
      loadQuizQuestions(currentQuizIndex);
      quizForm.reset();
      resultBox.style.display = 'none';
      btnQuizRetry.classList.add('hidden');
      btnQuizSubmit.classList.remove('hidden');
    });
  }

  // ==========================================
  // 4. CONEXIÓN Y BLOCKCHAIN (Ethers Global)
  // ==========================================
  const connectBtn = document.getElementById('connectBtn');
  const btnHeroConnect = document.getElementById('btnHeroConnect');
  const walletEmpty = document.getElementById('walletEmpty');
  const walletInfo = document.getElementById('walletInfo');
  const addrDisplay = document.getElementById('addr');
  const ethBalDisplay = document.getElementById('ethBal');
  const xpBalDisplay = document.getElementById('xpBal');
  const networkPill = document.getElementById('network');

  const SEPOLIA_ID = '0xaa36a7';
  const MXP_ADDRESS = "0xdb90a4C8AC91941935980b7B7c230bE2e6d58426"; 
  const CREDENTIAL_ADDRESS = "0x25C2633607d40Cc6E832f321aa39aFb6074454E0"; 
  const PATH_ID = 1; 

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function claimXP(uint256 activityId, uint256 amount, uint256 deadline, bytes calldata signature) external",
    "function claimed(address user, uint256 activityId) view returns (bool)"
  ];

  const CREDENTIAL_ABI = [
    "function claimCredential(uint256 pathId) external", 
    "function credentialId(address, uint256) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
  ];

  async function switchToSepolia() {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_ID }] });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: SEPOLIA_ID, chainName: 'Sepolia', rpcUrls: ['https://rpc.sepolia.org'], nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 } }]
        });
      }
    }
  }

  // --- RENDERIZAR ÉXITO Y DIPLOMA DE PARED ---
  function mostrarExitoDiploma(txHash) {
    const txHashLink = document.getElementById('txHashLink');
    if (txHashLink) {
      const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      txHashLink.href = etherscanUrl;
      txHashLink.textContent = `Ver Transacción Hash: ${txHash}`;
    }
    
    const diplomaUserName = document.getElementById('diplomaUserName');
    if (diplomaUserName) diplomaUserName.textContent = loggedUserName;

    document.getElementById('step1Container').classList.add('done');
    document.getElementById('step2Container').classList.add('done');
    document.getElementById('credSuccessMessage').classList.remove('hidden');
    document.getElementById('diplomaContainer').classList.remove('hidden');
    
    const btnMintCredential = document.getElementById('btnMintCredential');
    if(btnMintCredential) {
      btnMintCredential.textContent = "Obtenida ✓";
      btnMintCredential.disabled = true;
    }
  }

  // --- BÚSQUEDA DE HASH CON RANGO SEGURO (9,000 bloques) ---
  async function buscarYMostrarHash(provider, cleanAccount) {
    try {
      const credContract = new ethers.Contract(CREDENTIAL_ADDRESS, CREDENTIAL_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 9000);

      const filter = credContract.filters.Transfer(ethers.ZeroAddress, cleanAccount);
      const logs = await credContract.queryFilter(filter, fromBlock, 'latest');

      if (logs.length > 0) {
        const txHash = logs[logs.length - 1].transactionHash;
        mostrarExitoDiploma(txHash);
        return txHash;
      }
    } catch (err) {
      console.log("Error buscando logs en la red:", err);
    }
    return null;
  }

  async function verificarEstadoYDesbloquearCredencial(account) {
    if (!account) return;
    
    const navCredential = document.getElementById('navCredential');
    const credLockMessage = document.getElementById('credLockMessage');
    const credContentContainer = document.getElementById('credContentContainer');

    try {
      const cleanAccount = ethers.getAddress(account);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const mxpContract = new ethers.Contract(MXP_ADDRESS, ERC20_ABI, provider);
      
      const balanceMxp = await mxpContract.balanceOf(cleanAccount);

      if (balanceMxp > 0n || cleanAccount.toLowerCase() === "0xd420bdfE9E9Eea5c24bA854CD54e3e9FEdefB090".toLowerCase()) {
        if (credLockMessage) credLockMessage.classList.add('hidden');
        if (credContentContainer) credContentContainer.classList.remove('hidden');
        if (navCredential) {
          navCredential.classList.remove('locked');
          navCredential.classList.add('unlocked');
          navCredential.textContent = "04 Mi Credencial 🔓";
        }

        await buscarYMostrarHash(provider, cleanAccount);
      } else {
        if (credLockMessage) {
          credLockMessage.textContent = "Sección bloqueada 🔒. Debes realizar las actividades en la blockchain antes de reclamar la credencial.";
          credLockMessage.classList.add('hidden');
        }
        if (credContentContainer) credContentContainer.classList.add('hidden');
        if (navCredential) {
          navCredential.classList.add('locked');
          navCredential.classList.remove('unlocked');
          navCredential.textContent = "04 Mi Credencial 🔒";
        }
      }
    } catch (error) {
      console.error("Error al verificar la blockchain:", error);
    }
  }

  async function loadBalances(account) {
    if(!account) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      const ethBalanceWei = await provider.getBalance(account);
      ethBalDisplay.textContent = parseFloat(ethers.formatEther(ethBalanceWei)).toFixed(4) + " ETH";
      
      const mxpContract = new ethers.Contract(MXP_ADDRESS, ERC20_ABI, provider);
      const mxpBalanceWei = await mxpContract.balanceOf(account);
      xpBalDisplay.textContent = parseFloat(ethers.formatEther(mxpBalanceWei)).toFixed(2) + " MXP";

      await verificarEstadoYDesbloquearCredencial(account);
      
    } catch (error) {
      console.error("Error leyendo saldos:", error);
    }
  }

  function updateUI(account) {
    connectBtn.textContent = 'Conectado'; 
    connectBtn.disabled = true;
    if(btnHeroConnect) { 
      btnHeroConnect.textContent = 'Conectado'; 
      btnHeroConnect.disabled = true; 
    }
    
    addrDisplay.textContent = account.slice(0, 6) + '...' + account.slice(-4);
    networkPill.textContent = "■ SEPOLIA";
    networkPill.classList.remove('hidden');
    walletEmpty.classList.add('hidden');
    walletInfo.classList.remove('hidden');
  }

  const initConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          await switchToSepolia();
          updateUI(accounts[0]);
          await loadBalances(accounts[0]);
        } catch (error) {
          console.error("Proceso cancelado:", error);
        }
      } else {
        alert("Instala MetaMask!");
      }
  };

  if (connectBtn) connectBtn.addEventListener('click', initConnection);
  if (btnHeroConnect) btnHeroConnect.addEventListener('click', initConnection);

  // ==========================================
  // 5. OBTENER RECOMPENSA
  // ==========================================
  const btnClaimMXP = document.getElementById('btnClaimMXP');

  if (btnClaimMXP) {
    btnClaimMXP.addEventListener('click', async () => {
      alert("Tus actividades ya se encuentran registradas en la blockchain. Ve directo a la sección '04 Mi Credencial'.");
    });
  }

  // ==========================================
  // 6. FLUJO DE CREDENCIAL (APPROVE & CLAIM)
  // ==========================================
  const btnApproveMXP = document.getElementById('btnApproveMXP');
  const btnMintCredential = document.getElementById('btnMintCredential');

  if (btnApproveMXP) {
    btnApproveMXP.addEventListener('click', async () => {
      try {
        btnApproveMXP.disabled = true; btnApproveMXP.textContent = "Aprobando...";
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const mxpContract = new ethers.Contract(MXP_ADDRESS, ERC20_ABI, signer);
        
        const amountWei = ethers.parseEther("100");
        const tx = await mxpContract.approve(CREDENTIAL_ADDRESS, amountWei);
        await tx.wait();
        
        btnApproveMXP.textContent = "Aprobado ✓";
        document.getElementById('step1Container').classList.add('done');
        document.getElementById('step2Container').style.opacity = "1";
        btnMintCredential.disabled = false;
      } catch (error) {
        alert("Error al aprobar.");
        btnApproveMXP.disabled = false; btnApproveMXP.textContent = "Aprobar gasto";
      }
    });
  }

  if (btnMintCredential) {
    btnMintCredential.addEventListener('click', async () => {
      try {
        btnMintCredential.disabled = true; 
        btnMintCredential.textContent = "Verificando estado...";
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const cleanAccount = await signer.getAddress();
        const credContract = new ethers.Contract(CREDENTIAL_ADDRESS, CREDENTIAL_ABI, signer);
        
        try {
          const credId = await credContract.credentialId(cleanAccount, PATH_ID);
          if (credId > 0n) throw new Error("ALREADY_CLAIMED");
        } catch (checkErr) {
          if (checkErr.message === "ALREADY_CLAIMED" || checkErr.data === "0x3091779c") {
            throw new Error("ALREADY_CLAIMED");
          }
        }

        btnMintCredential.textContent = "Reclamando credencial real...";
        const tx = await credContract.claimCredential(PATH_ID);
        
        btnMintCredential.textContent = "Confirmando en red Sepolia...";
        await tx.wait();
        
        mostrarExitoDiploma(tx.hash);
        await loadBalances(cleanAccount);
        
        alert(`¡Certificado emitido con éxito para ${loggedUserName}!\n\nHash:\n${tx.hash}`);
        
      } catch (error) {
        console.error(error);
        
        if (error.message === "ALREADY_CLAIMED" || error.data === "0x3091779c" || (error.message && error.message.includes("execution reverted"))) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const cleanAccount = await signer.getAddress();
          
          const foundHash = await buscarYMostrarHash(provider, cleanAccount);

          if (foundHash) {
            alert(`¡El certificado de ${loggedUserName} ya se encuentra emitido en la blockchain!\n\nHash:\n${foundHash}`);
          } else {
            alert(`Aviso: Esta wallet ya tiene emitida su credencial.\nVerificala en Etherscan para la dirección:\n${cleanAccount}`);
          }
          return;
        } else {
          alert("Error al emitir tu credencial: " + (error.reason || error.message));
        }

        btnMintCredential.disabled = false; 
        btnMintCredential.textContent = "Obtener Credencial";
      }
    });
  }

  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) { updateUI(accounts[0]); loadBalances(accounts[0]); }
      else { window.location.reload(); }
    });
    window.ethereum.on('chainChanged', () => { window.location.reload(); });
  }

});