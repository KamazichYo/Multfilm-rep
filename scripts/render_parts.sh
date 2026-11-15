#!/bin/bash
# Renders the short in two halves (each fits a 2 h job), then joins them. Usage: scripts/render_parts.sh out/kopenick/v1 [a|b|join]
P=$1
case $2 in
  a) scripts/render.sh ${P}_a.mp4 --frames=0-819 ;;
  b) scripts/render.sh ${P}_b.mp4 --frames=820-1639 ;;
  join) printf "file '%s'\nfile '%s'\n" $(realpath ${P}_a.mp4) $(realpath ${P}_b.mp4) > ${P}_list.txt
        ffmpeg -v error -y -f concat -safe 0 -i ${P}_list.txt -c copy ${P}_silent.mp4 ;;
esac
