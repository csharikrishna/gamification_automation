// Multiplying Ball Race - Obstacles & Tiles Rendering Layer
// Renders 3D metallic chrome pachinko pegs, crystal energy gates, anchor pylons,
// durability rails, multiplier rule capsules, kinetic impact starbursts, and gateway threshold lines.

function drawObstaclesAndTiles(renderer, engine) {
  const ctx = renderer.ctx;

  for (const side of ['left', 'right']) {
    const lane = engine.lanes[side];

    // 1. Draw Pachinko Pegs (3D Chrome Arcade Pinball Bumpers)
    for (const peg of lane.pegs) {
      ctx.save();
      const r = peg.radius;

      // Subtle contact shadow
      ctx.beginPath();
      ctx.arc(peg.x, peg.y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // 3D Metallic Chrome Peg
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
      const pegGrad = ctx.createRadialGradient(peg.x - r * 0.35, peg.y - r * 0.35, 1, peg.x, peg.y, r);
      if (peg.glow > 0.05) {
        pegGrad.addColorStop(0, '#ffffff');
        pegGrad.addColorStop(0.4, '#ffffff');
        pegGrad.addColorStop(1, lane.color);
      } else {
        pegGrad.addColorStop(0, '#ffffff');
        pegGrad.addColorStop(0.28, '#e2e8f0');
        pegGrad.addColorStop(0.70, '#94a3b8');
        pegGrad.addColorStop(1, '#475569');
      }
      ctx.fillStyle = pegGrad;
      ctx.fill();

      // Dark nickel outer rim with crisp chrome outline
      ctx.strokeStyle = peg.glow > 0.05 ? '#ffffff' : 'rgba(255, 255, 255, 0.40)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Impact flash shockwave ring when hit
      if (peg.glow > 0.15) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, r + peg.glow * 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${peg.glow * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Draw Multiplier Barrier Tiles (Interactive Kinetic Energy Gates)
    for (const tile of lane.tiles) {
      ctx.save();
      const tileX = tile.minX;
      const tileY = tile.y - tile.height / 2;
      const tileW = tile.width;
      const tileH = tile.height;
      const isActive = (tile.index === lane.currentTier);

      if (tile.intact) {
        // A. Metallic Anchor Pylons on Lane Walls (Visual Support Brackets)
        const pylonW = 18;
        ctx.fillStyle = '#181e2e';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.2;

        // Left Pylon
        ctx.beginPath();
        ctx.roundRect(tileX, tileY - 4, pylonW, tileH + 8, [6, 2, 2, 6]);
        ctx.fill();
        ctx.stroke();

        // Left pylon neon power conduit
        ctx.beginPath();
        ctx.moveTo(tileX + pylonW - 3, tileY + 2);
        ctx.lineTo(tileX + pylonW - 3, tileY + tileH - 2);
        ctx.strokeStyle = isActive ? lane.color : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Right Pylon
        ctx.beginPath();
        ctx.roundRect(tileX + tileW - pylonW, tileY - 4, pylonW, tileH + 8, [2, 6, 6, 2]);
        ctx.fillStyle = '#181e2e';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();

        // Right pylon neon power conduit
        ctx.beginPath();
        ctx.moveTo(tileX + tileW - pylonW + 3, tileY + 2);
        ctx.lineTo(tileX + tileW - pylonW + 3, tileY + tileH - 2);
        ctx.strokeStyle = isActive ? lane.color : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // B. Unified Arcade Energy Barrier / Crystalline Gate
        const fieldX = tileX + pylonW + 2;
        const fieldW = tileW - (pylonW * 2) - 4;
        const hpRatio = Math.max(0, Math.min(1.0, tile.currentHP / tile.maxHP));
        const isWarning = (hpRatio < 0.28);
        const warningPulse = isWarning ? (Math.sin(engine.simTime * 18) * 0.25 + 0.75) : 1.0;
        const isHitFlash = (tile.glowIntensity > 0.15);

        // 1. Crystal Substrate Body (Rounded continuous slab)
        ctx.beginPath();
        ctx.roundRect(fieldX, tileY + 2, fieldW, tileH - 4, 8);
        const bodyGrad = ctx.createLinearGradient(fieldX, tileY, fieldX, tileY + tileH);
        bodyGrad.addColorStop(0, '#0c111e');
        bodyGrad.addColorStop(0.5, '#131b2e');
        bodyGrad.addColorStop(1, '#090d18');
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // 2. Dynamic Energy Shield / Plasma Core
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8, 6);
        ctx.clip();

        // Internal Shield Plasma Fill
        const shieldGrad = ctx.createLinearGradient(fieldX, tileY + 4, fieldX + fieldW, tileY + 4);
        if (isHitFlash) {
          shieldGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
          shieldGrad.addColorStop(0.5, isWarning ? 'rgba(255, 170, 0, 0.50)' : `rgba(${lane.side === 'left' ? '245,154,255' : '178,255,138'}, 0.50)`);
          shieldGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
        } else if (isWarning) {
          // Vibrant warning state: pulsing amber/neon warning hue
          shieldGrad.addColorStop(0, `rgba(255, 80, 0, ${0.15 * warningPulse})`);
          shieldGrad.addColorStop(0.5, `rgba(255, 185, 0, ${0.40 * warningPulse})`);
          shieldGrad.addColorStop(1, `rgba(255, 80, 0, ${0.15 * warningPulse})`);
        } else if (isActive) {
          // Stable charged team color energy field
          const shieldAlpha = 0.20 + hpRatio * 0.22;
          shieldGrad.addColorStop(0, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${shieldAlpha * 0.6})`);
          shieldGrad.addColorStop(0.5, `rgba(${lane.side === 'left' ? '245,154,255' : '178,255,138'}, ${shieldAlpha})`);
          shieldGrad.addColorStop(1, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${shieldAlpha * 0.6})`);
        } else {
          shieldGrad.addColorStop(0, 'rgba(50, 65, 95, 0.15)');
          shieldGrad.addColorStop(0.5, 'rgba(70, 90, 130, 0.25)');
          shieldGrad.addColorStop(1, 'rgba(50, 65, 95, 0.15)');
        }
        ctx.fillStyle = shieldGrad;
        ctx.fillRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8);

        // Subtle horizontal energy scanlines
        ctx.strokeStyle = isWarning
          ? `rgba(255, 190, 0, ${0.12 * warningPulse})`
          : (isActive ? `rgba(255, 255, 255, 0.08)` : 'rgba(255, 255, 255, 0.03)');
        ctx.lineWidth = 1.0;
        for (let ly = tileY + 8; ly < tileY + tileH - 8; ly += 5) {
          ctx.beginPath();
          ctx.moveTo(fieldX + 4, ly);
          ctx.lineTo(fieldX + fieldW - 4, ly);
          ctx.stroke();
        }

        // 3. Dynamic Internal Shield Energy Excitation & Stress Field (Zero Disconnected Slashes)
        if (hpRatio < 0.85) {
          const stressAmount = Math.max(0, 1.0 - hpRatio);
          const stressAlpha = Math.min(0.85, stressAmount * 0.9);

          ctx.save();
          const stressGrad = ctx.createLinearGradient(fieldX, tileY, fieldX + fieldW, tileY);
          if (isWarning) {
            stressGrad.addColorStop(0, `rgba(255, 70, 0, ${stressAlpha * 0.35})`);
            stressGrad.addColorStop(0.5, `rgba(255, 180, 0, ${stressAlpha * 0.65})`);
            stressGrad.addColorStop(1, `rgba(255, 70, 0, ${stressAlpha * 0.35})`);
          } else {
            stressGrad.addColorStop(0, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${stressAlpha * 0.25})`);
            stressGrad.addColorStop(0.5, `rgba(255, 255, 255, ${stressAlpha * 0.45})`);
            stressGrad.addColorStop(1, `rgba(${lane.side === 'left' ? '203,114,255' : '121,239,67'}, ${stressAlpha * 0.25})`);
          }
          ctx.fillStyle = stressGrad;
          ctx.fillRect(fieldX + 2, tileY + 4, fieldW - 4, tileH - 8);
          ctx.restore();
        }

        ctx.restore(); // end clip

        // 4. Sleek Internal Durability Gauge (High-Tech Arcade Power Rail)
        const gaugePad = 16;
        const gaugeX = fieldX + gaugePad;
        const gaugeW = fieldW - (gaugePad * 2);
        const gaugeH = 4;
        const gaugeY = tileY + tileH - 8;

        // Gauge Track Backing
        ctx.fillStyle = 'rgba(4, 7, 14, 0.85)';
        ctx.beginPath();
        ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Luminous Gauge Fill
        if (hpRatio > 0.01) {
          const fillW = Math.max(3, gaugeW * hpRatio);
          const fillGrad = ctx.createLinearGradient(gaugeX, gaugeY, gaugeX + fillW, gaugeY);
          if (isWarning) {
            fillGrad.addColorStop(0, '#ff3d00');
            fillGrad.addColorStop(0.7, '#ff9100');
            fillGrad.addColorStop(1, '#ffd700');
          } else if (isActive) {
            fillGrad.addColorStop(0, lane.color);
            fillGrad.addColorStop(0.6, lane.accentColor);
            fillGrad.addColorStop(1, '#ffffff');
          } else {
            fillGrad.addColorStop(0, 'rgba(80, 105, 145, 0.5)');
            fillGrad.addColorStop(1, 'rgba(140, 165, 210, 0.7)');
          }
          ctx.fillStyle = fillGrad;
          ctx.beginPath();
          ctx.roundRect(gaugeX, gaugeY, fillW, gaugeH, 2);
          ctx.fill();

          // Leading Edge Energy Bead
          if (isActive && hpRatio > 0.05) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(gaugeX + fillW, gaugeY + gaugeH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = isWarning ? '#ff9100' : lane.accentColor;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.restore();
          }
        }

        // Gauge Calibrated Tick Marks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.0;
        for (let t = 1; t <= 3; t++) {
          const tx = gaugeX + (gaugeW / 4) * t;
          ctx.beginPath();
          ctx.moveTo(tx, gaugeY - 1);
          ctx.lineTo(tx, gaugeY + gaugeH + 1);
          ctx.stroke();
        }

        // 5. Crystalline Outer Frame & Top-Edge Specular Highlight
        ctx.beginPath();
        ctx.roundRect(fieldX, tileY + 2, fieldW, tileH - 4, 8);
        ctx.strokeStyle = isHitFlash
          ? '#ffffff'
          : (isWarning
              ? `rgba(255, 140, 0, ${0.65 * warningPulse + 0.25})`
              : (isActive ? `rgba(255, 255, 255, 0.45)` : 'rgba(255, 255, 255, 0.16)'));
        ctx.lineWidth = isActive ? 1.5 : 1.0;
        if (isActive || isWarning) {
          ctx.shadowColor = isWarning ? '#ff5722' : lane.color;
          ctx.shadowBlur = (isWarning ? 12 : 8) * warningPulse;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Top edge specular glass bevel
        ctx.beginPath();
        ctx.moveTo(fieldX + 8, tileY + 3.5);
        ctx.lineTo(fieldX + fieldW - 8, tileY + 3.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // C. Central Kinetic Multiplier Capsule (Seamlessly Docked Arcade Core)
        const coreW = 108;
        const coreH = tileH + 8;
        const coreX = tileX + (tileW - coreW) / 2;
        const coreY = tile.y - coreH / 2;
        const pulse = Math.sin(engine.simTime * 6.5) * 0.12 + 0.88;

        ctx.beginPath();
        ctx.roundRect(coreX, coreY, coreW, coreH, coreH / 2);
        const coreGrad = ctx.createLinearGradient(coreX, coreY, coreX, coreY + coreH);
        const isTriggerActive = (tile.triggerPulse && tile.triggerPulse > 0.05);
        if (tile.triggerPulse) tile.triggerPulse *= 0.90;

        // Always maintain a rich, high-contrast dark crystal body for maximum text legibility
        if (isTriggerActive || tile.glowIntensity > 0.25) {
          coreGrad.addColorStop(0, '#1c243a');
          coreGrad.addColorStop(0.5, '#121828');
          coreGrad.addColorStop(1, '#090d16');
        } else if (isActive) {
          coreGrad.addColorStop(0, '#161d30');
          coreGrad.addColorStop(0.5, '#0e1322');
          coreGrad.addColorStop(1, '#070a12');
        } else {
          coreGrad.addColorStop(0, '#101422');
          coreGrad.addColorStop(1, '#060810');
        }
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // High-luminance neon border rim
        ctx.strokeStyle = (isTriggerActive || tile.glowIntensity > 0.2)
          ? '#ffffff'
          : (isActive ? lane.accentColor : 'rgba(255, 255, 255, 0.22)');
        ctx.lineWidth = isActive ? 2.2 : 1.2;
        if (isActive || isTriggerActive) {
          ctx.shadowColor = (isTriggerActive || tile.glowIntensity > 0.2) ? '#ffffff' : lane.color;
          ctx.shadowBlur = (isTriggerActive ? 18 : 10) * pulse;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Crisp Multiplier Rule Label with dark backdrop contrast
        ctx.font = '950 25px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.70)';
        ctx.fillText(tile.label, tileX + tileW / 2, tile.y);
        ctx.restore();

        // D. Attached Collision Kinetic Feedback
        if (tile.recentImpacts && tile.recentImpacts.length > 0) {
          for (const imp of tile.recentImpacts) {
            const age = engine.simTime - imp.time;
            if (age < 0.12) {
              const p = age / 0.12;
              const alpha = (1 - p) * imp.intensity;

              ctx.save();
              // Horizontal top surface kinetic energy pulse
              ctx.beginPath();
              const ripW = 14 * (1 - p);
              ctx.moveTo(Math.max(fieldX + 2, imp.x - ripW), tileY + 2);
              ctx.lineTo(Math.min(fieldX + fieldW - 2, imp.x + ripW), tileY + 2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.90})`;
              ctx.lineWidth = 1.8 * (1 - p);
              ctx.shadowColor = lane.accentColor;
              ctx.shadowBlur = 6;
              ctx.stroke();

              // Tight kinetic impact starburst at contact point
              const starSize = 4.0 * (1 - p);
              ctx.beginPath();
              ctx.moveTo(imp.x - starSize, imp.y);
              ctx.lineTo(imp.x + starSize, imp.y);
              ctx.moveTo(imp.x, imp.y - starSize);
              ctx.lineTo(imp.x, imp.y + starSize);
              ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
              ctx.lineWidth = 1.2;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 8;
              ctx.stroke();

              // Core contact spark
              ctx.beginPath();
              ctx.arc(imp.x, imp.y, 2.0 * (1 - p), 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
              ctx.fill();
              ctx.restore();
            }
          }
        }

      } else {
        // --- HIGH-SPEED LINEAR SEAM DISCHARGE & CLEAN OPEN GATEWAY ---
        const teamRgb = lane.side === 'left' ? '203, 114, 255' : '121, 239, 67';

        if (tile.shatterTime !== undefined && (engine.simTime - tile.shatterTime < 0.11)) {
          const sAge = engine.simTime - tile.shatterTime;
          const p = sAge / 0.11;
          const alpha = 1.0 - p;
          const centerX = tileX + tileW / 2;
          const centerY = tile.y;

          ctx.save();

          // 1. Horizontal Linear Seam Plasma Discharge
          const seamW = tileW - 32;
          const seamX = tileX + 16;
          const seamGrad = ctx.createLinearGradient(seamX, centerY, seamX + seamW, centerY);
          seamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          seamGrad.addColorStop(0.2, `rgba(${teamRgb}, ${alpha * 0.75})`);
          seamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.95})`);
          seamGrad.addColorStop(0.8, `rgba(${teamRgb}, ${alpha * 0.75})`);
          seamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.beginPath();
          ctx.moveTo(seamX, centerY);
          ctx.lineTo(seamX + seamW, centerY);
          ctx.strokeStyle = seamGrad;
          ctx.lineWidth = 3.2 * (1 - p);
          ctx.shadowColor = lane.accentColor;
          ctx.shadowBlur = 12;
          ctx.stroke();

          // Secondary hairline core fracture
          ctx.beginPath();
          ctx.moveTo(seamX + 20, centerY);
          ctx.lineTo(seamX + seamW - 20, centerY);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 1.2 * (1 - p);
          ctx.shadowBlur = 0;
          ctx.stroke();

          // 2. Compact Trigger Core Starburst
          if (sAge < 0.08) {
            const pCore = sAge / 0.08;
            const coreAlpha = 1.0 - pCore;
            const coreR = 4 + (1 - Math.pow(1 - pCore, 2)) * 8;

            ctx.beginPath();
            ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha * 0.9})`;
            ctx.shadowColor = lane.accentColor;
            ctx.shadowBlur = 10;
            ctx.fill();

            const flareLen = (1 - pCore) * 18;
            ctx.beginPath();
            ctx.moveTo(centerX - flareLen, centerY);
            ctx.lineTo(centerX + flareLen, centerY);
            ctx.moveTo(centerX, centerY - flareLen * 0.45);
            ctx.lineTo(centerX, centerY + flareLen * 0.45);
            ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha * 0.95})`;
            ctx.lineWidth = 1.4 * (1 - pCore);
            ctx.stroke();
          }

          ctx.restore();
        }

        // Open threshold with clean dotted energy line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(tileX + 16, tile.y);
        ctx.lineTo(tileX + tileW - 16, tile.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Gateway mounting pylons with persistent team illumination
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(tileX, tileY + 4); ctx.lineTo(tileX + 12, tileY + 4);
        ctx.moveTo(tileX, tileY + tileH - 4); ctx.lineTo(tileX + 12, tileY + tileH - 4);
        ctx.moveTo(tileX + tileW, tileY + 4); ctx.lineTo(tileX + tileW - 12, tileY + 4);
        ctx.moveTo(tileX + tileW, tileY + tileH - 4); ctx.lineTo(tileX + tileW - 12, tileY + tileH - 4);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}

if (typeof window !== 'undefined') {
  window.drawObstaclesAndTiles = drawObstaclesAndTiles;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawObstaclesAndTiles };
}
