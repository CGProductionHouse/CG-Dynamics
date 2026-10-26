// Bounded reliability patch for the approved vendor panel; not another editor/service.
function once(source, before, after) {
  if(source.split(before).length!==2)throw Error('Session patch anchor changed or ambiguous');
  return source.replace(before,after);
}
function repairTransport(source) {
  return once(source,'return await this.waitForResponse(responseFile, timeoutMs);',
    `const response = await this.waitForResponse(responseFile, timeoutMs);
      if (response && response.nolanGuard === true && response.success === false) {
        throw new Error(String(response.error || 'Protected Premiere session refused command'));
      }
      return response;`);
}
function repairPanel(source) {
  source=once(source,'        this.startCommandPolling();','        this.startCommandPolling();\n        this.restoreNolanSession();');
  source=once(source,'    MCPPremiereBridge.prototype.getTempDirectory = function() {',`
    // Opt-in, expiring duplicate-only session. No saved permission/security setting.
    MCPPremiereBridge.prototype.readNolanSession = function() {
        var sessionPath = path.join(this.getTempDirectory(), 'nolan-session.json');
        if (!fs.existsSync(sessionPath)) return null;
        var session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        var expiry = Date.parse(session.expiresAt);
        if (!session.projectPath || !session.sequenceId || !isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 7200000) throw new Error('Protected session missing or expired');
        return session;
    };
    MCPPremiereBridge.prototype.nolanScopeExpression = function(session) {
        return '(function(){' +
          'function norm(s){return String(s||" ").split(String.fromCharCode(92)).join("/").toLowerCase();}' +
          'var p=app.project;' +
          'if(!p || norm(p.path)!==norm(' + JSON.stringify(session.projectPath) + '))return "Protected project mismatch";' +
          'if(!p.activeSequence || String(p.activeSequence.sequenceID)!==' + JSON.stringify(session.sequenceId) + ')return "Protected sequence mismatch";' +
          'return null;})()';
    };
    MCPPremiereBridge.prototype.restoreNolanSession = function() {
        var self=this, session;
        try { session=this.readNolanSession(); } catch(e) { this.log(e.message,'error'); return; }
        if (!session || session.reconnect !== true) return;
        this.executeExtendScript('JSON.stringify({scopeError:' + this.nolanScopeExpression(session) + '});', function(err,result) {
            if (!err && result && result.scopeError === null) self.startBridge();
            else self.log('Protected reconnect refused: ' + (err ? err.message : 'project/sequence mismatch'), 'error');
        });
    };
    MCPPremiereBridge.prototype.getTempDirectory = function() {`);
  source=once(source,'        this.executeExtendScript(command.script, function(err, result) {',`
        var session;
        try {
            session=this.readNolanSession();
            if(session) {
                var age=Date.now()-Date.parse(command.timestamp);
                var lifetime=Math.min(typeof command.timeoutMs==='number' ? command.timeoutMs : 60000,300000);
                if(!isFinite(age) || age < -5000 || age > lifetime) throw new Error('Expired protected command; no replay');
            }
        } catch(sessionError) { done({success:false,nolanGuard:true,error:sessionError.message,mutated:false}); return; }
        var scopedScript=command.script;
        if(session) {
            scopedScript='var __nolanScopeError=' + this.nolanScopeExpression(session) + ';' +
              'if(__nolanScopeError){JSON.stringify({success:false,nolanGuard:true,error:__nolanScopeError,mutated:false});}else{' + command.script + '\\n}';
        }
        this.executeExtendScript(scopedScript, function(err, result) {`);
  source=once(source,'            done({ success: true, result: result, timestamp: new Date().toISOString() });',
    `            if(result && result.nolanGuard===true && result.success===false) { done(result); return; }
            done({ success: true, result: result, timestamp: new Date().toISOString() });`);
  return source;
}
module.exports={repairPanel,repairTransport};
