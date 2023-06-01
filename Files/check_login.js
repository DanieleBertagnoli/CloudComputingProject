function check() {
    // Ottieni i valori inseriti dall'utente
    var email = document.getElementById("email").value;
    var password = document.getElementById("password").value;
  
    // Verifica l'email e la password
    // Qui dovresti avere la logica per la verifica dei dati di accesso
    // Puoi confrontare i valori con quelli memorizzati nel tuo database o in un array
  
    // Esempio di verifica (da sostituire con la tua logica di verifica reale)
    if (email === "esempio@email.com" && password === "password123") {
      // Reindirizza a game.html se i dati di accesso sono corretti
      window.location.href = "game.html";
    } else {
      // Altrimenti, mostra un messaggio di errore o esegui altre azioni
      alert("Credenziali di accesso non valide. Riprova.");
    }
  
    // Evita l'invio del modulo
    return false;
  }
  