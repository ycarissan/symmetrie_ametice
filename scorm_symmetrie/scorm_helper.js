/**
 * SCORM 1.2 API Helper pour Moodle
 * Gère la communication avec le LMS (initialisation, sauvegarde du score, etc.)
 */

var SCORM = {
    // Variables SCORM standard
    status: {
        NOT_ATTEMPTED: "not attempted",
        INCOMPLETE: "incomplete",
        COMPLETED: "completed",
        PASSED: "passed",
        FAILED: "failed",
        BROWSED: "browsed"
    },
    
    // API LMS
    api: null,
    
    // Vrai après LMSFinish : plus aucun appel n'est autorisé par le LMS
    terminated: false,
    
    // Début de la session (pour cmi.core.session_time)
    startTime: null,
    
    // Initialise la connexion SCORM
    init: function() {
        this.api = this.getAPI();
        if (this.api) {
            this.api.LMSInitialize("");
            this.startTime = new Date();
            return true;
        }
        console.log("SCORM API non détectée - mode hors LMS");
        return false;
    },
    
    // Récupère l'API SCORM (pour Moodle et autres LMS)
    getAPI: function() {
        var api = null;
        
        // Moodle et la plupart des LMS
        if (window.API_LMS && window.API_LMS.LMSInitialize) {
            api = window.API_LMS;
        }
        // Alternative pour certains LMS
        else if (window.API && window.API.LMSInitialize) {
            api = window.API;
        }
        // Recherche dans les frames parent, puis dans la fenêtre ouvrante (popup)
        else {
            api = this.findAPIInParents(window);
            if (!api && window.opener) {
                api = this.findAPIInParents(window.opener);
            }
        }
        
        return api;
    },
    
    findAPIInParents: function(win) {
        try {
            for (var depth = 0; win && depth < 10; depth++) {
                if (win.API_LMS && win.API_LMS.LMSInitialize) return win.API_LMS;
                if (win.API && win.API.LMSInitialize) return win.API;
                if (!win.parent || win.parent === win) break;
                win = win.parent;
            }
        } catch (e) {
            // Fenêtre d'une autre origine : inaccessible
        }
        return null;
    },
    
    // Sauvegarde une valeur SCORM
    setValue: function(element, value) {
        if (this.api && !this.terminated) {
            try {
                return this.api.LMSSetValue(element, value);
            } catch (e) {
                console.log("Erreur LMSSetValue: " + e);
                return false;
            }
        }
        return false;
    },
    
    // Récupère une valeur SCORM
    getValue: function(element) {
        if (this.api && !this.terminated) {
            try {
                return this.api.LMSGetValue(element);
            } catch (e) {
                console.log("Erreur LMSGetValue: " + e);
                return null;
            }
        }
        return null;
    },
    
    // Valide (commit) les données
    commit: function() {
        if (this.api && !this.terminated) {
            try {
                return this.api.LMSCommit("");
            } catch (e) {
                console.log("Erreur LMSCommit: " + e);
                return false;
            }
        }
        return false;
    },
    
    // Termine la session SCORM (enregistre le temps passé au préalable)
    finish: function() {
        if (this.api && !this.terminated) {
            if (this.startTime) {
                this.setSessionTime((new Date() - this.startTime) / 1000);
            }
            this.terminated = true;
            try {
                return this.api.LMSFinish("");
            } catch (e) {
                console.log("Erreur LMSFinish: " + e);
                return false;
            }
        }
        return false;
    },
    
    // Sauvegarde le score (0-100)
    setScore: function(score) {
        score = Math.round(score * 100) / 100; // Arrondi à 2 décimales
        this.setValue("cmi.core.score.raw", score);
        this.setValue("cmi.core.score.max", 100);
        this.setValue("cmi.core.score.min", 0);
        this.commit();
    },
    
    // Sauvegarde le statut
    setStatus: function(status) {
        this.setValue("cmi.core.lesson_status", status);
        this.commit();
    },
    
    // Sauvegarde le temps passé (en secondes)
    setSessionTime: function(seconds) {
        var timeStr = this.formatTime(seconds);
        this.setValue("cmi.core.session_time", timeStr);
        this.commit();
    },
    
    // Formate le temps au format SCORM (HHH:MM:SS.SS)
    formatTime: function(totalSeconds) {
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = Math.round(totalSeconds % 60);
        
        // Pad avec des zéros
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        
        return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    },
    
    // Récupère le nom de l'apprenant
    getStudentName: function() {
        return this.getValue("cmi.core.student_name");
    },
    
    // Récupère l'ID de l'apprenant
    getStudentID: function() {
        return this.getValue("cmi.core.student_id");
    }
};

// Initialisation automatique au chargement
window.addEventListener('load', function() {
    SCORM.init();
});

// Gestion du déchargement (sauvegarde avant de quitter)
window.addEventListener('beforeunload', function() {
    try {
        SCORM.finish();
    } catch (e) {
        // Ignorer les erreurs
    }
});
